import { Source } from "@/db/knowledge"
import { addNewSources } from "@/db/dexie/knowledge"
import { defaultEmbeddingModelForRag } from "@/services/ollama"
import { convertTextToSource, convertToSource } from "@/utils/to-source"
import { useMutation } from "@tanstack/react-query"
import {
  Modal,
  Form,
  Input,
  Upload,
  message,
  UploadFile,
  Tabs,
  Select
} from "antd"
import { InboxIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import PubSub from "pubsub-js"
import { KNOWLEDGE_QUEUE } from "@/queue"
import { useStorage } from "@plasmohq/storage/hook"
import { unsupportedTypes } from "./utils/unsupported-types"
import React from "react"

type Props = {
  id: string
  open: boolean
  setOpen: React.Dispatch<React.SetStateAction<boolean>>
}

export const UpdateKnowledge = ({ id, open, setOpen }: Props) => {
  const { t } = useTranslation(["knowledge", "common"])
  const [form] = Form.useForm()
  const [totalFilePerKB] = useStorage("totalFilePerKB", 5)
  const [mode, setMode] = React.useState<"upload" | "text">("upload")

  const onUploadHandler = async (data: any) => {
    const defaultEM = await defaultEmbeddingModelForRag()

    if (!defaultEM) {
      throw new Error(t("noEmbeddingModel"))
    }

    const source: Source[] = []

    const allowedTypes = [
      "application/pdf",
      "text/csv",
      "text/plain",
      "text/markdown",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ]

    if (mode === "upload") {
      for (const file of data.file || []) {
        let mime = file.type
        if (!allowedTypes.includes(mime)) {
          mime = "text/plain"
        }
        const _src = await convertToSource({
          file,
          mime,
          sourceType: "file_upload"
        })
        source.push(_src)
      }
    } else {
      const rawText: string = (data?.textContent || "").trim()
      const textType: string = data?.textType || "plain"
      if (!rawText) {
        throw new Error(t("form.textInput.required"))
      }
      if (rawText.length > 500000) {
        throw new Error(t("form.textInput.tooLarge"))
      }

      const asMarkdown = textType === "markdown"
      const filename = `pasted_${new Date().getTime()}.txt`
      const _src = await convertTextToSource({
        text: rawText,
        filename,
        mime: asMarkdown ? "text/markdown" : "text/plain",
        asMarkdown,
        sourceType: "text_input"
      })
      source.push(_src)
    }

    await addNewSources(id, source)
    return id
  }

  const { mutate: saveKnowledge, isPending: isSaving } = useMutation({
    mutationFn: onUploadHandler,
    onError: (error) => {
      message.error(error.message)
    },
    onSuccess: async (id) => {
      message.success(t("form.success"))
      PubSub.publish(KNOWLEDGE_QUEUE, id)
      form.resetFields()
      setOpen(false)
    }
  })

  return (
    <Modal
      title={t("updateKnowledge")}
      open={open}
      footer={null}
      onCancel={() => setOpen(false)}>
      <Tabs
        activeKey={mode}
        onChange={(key) => setMode(key as any)}
        items={[
          { key: "upload", label: t("form.tabs.upload") },
          { key: "text", label: t("form.tabs.text") }
        ]}
      />
      <Form onFinish={saveKnowledge} form={form} layout="vertical">
        {mode === "upload" ? (
          <Form.Item
            name="file"
            label={t("form.uploadFile.label")}
            rules={[
              {
                required: true,
                message: t("form.uploadFile.required")
              }
            ]}
            getValueFromEvent={(e) => {
              if (Array.isArray(e)) {
                return e
              }
              return e?.fileList
            }}>
            <Upload.Dragger
              multiple={true}
              maxCount={totalFilePerKB}
              beforeUpload={(file) => {
                const allowedTypes = [
                  "application/pdf",
                  "text/csv",
                  "text/plain",
                  "text/markdown",
                  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                ]
                  .map((type) => type.toLowerCase())
                  .join(", ")

                if (unsupportedTypes.includes(file.type.toLowerCase())) {
                  message.error(
                    t("form.uploadFile.uploadError", { allowedTypes })
                  )
                  return Upload.LIST_IGNORE
                }

                return false
              }}>
              <div className="p-3">
                <p className="flex justify-center ant-upload-drag-icon">
                  <InboxIcon className="w-10 h-10 text-gray-400" />
                </p>
                <p className="ant-upload-text">
                  {t("form.uploadFile.uploadText")}
                </p>
              </div>
            </Upload.Dragger>
          </Form.Item>
        ) : (
          <>
            <Form.Item
              name="textType"
              label={t("form.textInput.typeLabel")}
              initialValue="plain">
              <Select
                options={[
                  { value: "plain", label: t("form.textInput.type.plain") },
                  {
                    value: "markdown",
                    label: t("form.textInput.type.markdown")
                  },
                  { value: "code", label: t("form.textInput.type.code") }
                ]}
              />
            </Form.Item>
            <Form.Item
              name="textContent"
              label={t("form.textInput.contentLabel")}
              rules={[
                { required: true, message: t("form.textInput.required") }
              ]}>
              <Input.TextArea
                autoSize={{ minRows: 8, maxRows: 16 }}
                placeholder={t("form.textInput.placeholder")}
              />
            </Form.Item>
          </>
        )}

        <Form.Item>
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center justify-center w-full px-2 py-2 font-medium leading-4 text-center text-white bg-surface-900 border border-transparent rounded-md shadow-sm text-md hover:bg-surface-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:bg-surface-50 dark:text-gray-800 dark:hover:bg-surface-100 dark:focus:ring-gray-500 dark:focus:ring-offset-gray-100 disabled:opacity-50">
            {t("form.submit")}
          </button>
        </Form.Item>
      </Form>
    </Modal>
  )
}

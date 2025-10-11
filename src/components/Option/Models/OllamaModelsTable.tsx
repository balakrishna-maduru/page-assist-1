import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Skeleton, Table, Tag, Tooltip, notification, Avatar } from "antd"
import { bytePerSecondFormatter } from "~/libs/byte-formater"
import { deleteModel, getAllModels } from "~/services/ollama"
import dayjs from "dayjs"
import relativeTime from "dayjs/plugin/relativeTime"
import { useForm } from "@mantine/form"
import {
  ExternalLink,
  Pencil,
  RotateCcw,
  Settings,
  Trash2,
  X
} from "lucide-react"
import { useTranslation } from "react-i18next"
import { useStorage } from "@/packages/storage/hook"
import { ModelNickModelNicknameModal } from "./ModelNicknameModal"
import { useState, useEffect } from "react"
import { AddUpdateModelSettings } from "./AddUpdateModelSettings"
import { getDownloadState } from "~/utils/pull-ollama"
import { browser } from "wxt/browser"
import { CancelPullingModel } from "./CancelPullingModel"

dayjs.extend(relativeTime)

export const OllamaModelsTable = () => {
  const queryClient = useQueryClient()
  const { t } = useTranslation(["settings", "common", "openai"])
  const [selectedModel, setSelectedModel] = useStorage("selectedModel")
  const [openNicknameModal, setOpenNicknameModal] = useState(false)
  const [openSettingsModal, setOpenSettingsModal] = useState(false)
  const [downloadState, setDownloadState] = useState({
    modelName: null,
    isDownloading: false
  })
  const [model, setModel] = useState<{
    model_id: string
    model_name?: string
    model_avatar?: string
  }>({
    model_id: "",
    model_name: "",
    model_avatar: ""
  })

  const form = useForm({
    initialValues: {
      model: ""
    }
  })

  useEffect(() => {
    const checkDownloadState = async () => {
      const state = await getDownloadState()
      if (
        state &&
        typeof state === "object" &&
        "modelName" in state &&
        "isDownloading" in state
      ) {
        setDownloadState(state)
      } else {
        setDownloadState({ modelName: null, isDownloading: false })
      }
    }

    checkDownloadState()
    const interval = setInterval(checkDownloadState, 1000)

    return () => clearInterval(interval)
  }, [])

  const { data, status } = useQuery({
    queryKey: ["fetchAllModels"],
    queryFn: async () => await getAllModels({ returnEmpty: true })
  })

  const { mutate: deleteOllamaModel } = useMutation({
    mutationFn: deleteModel,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["fetchAllModels"]
      })
      notification.success({
        message: t("manageModels.notification.success"),
        description: t("manageModels.notification.successDeleteDescription")
      })
    },
    onError: (error) => {
      notification.error({
        message: "Error",
        description: error?.message || t("manageModels.notification.someError")
      })
    }
  })

  const pullModel = async (modelName: string) => {
    notification.info({
      message: t("manageModels.notification.pullModel"),
      description: t("manageModels.notification.pullModelDescription", {
        modelName
      })
    })

    form.reset()

    browser.runtime.sendMessage({
      type: "pull_model",
      modelName
    })

    return true
  }

  const { mutate: pullOllamaModel } = useMutation({
    mutationFn: pullModel
  })

  const cancelDownloadModel = () => {
    browser.runtime.sendMessage({
      type: "cancel_download"
    })
    notification.info({
      message: t("manageModels.notification.cancellingDownload"),
      description: t("manageModels.notification.cancellingDownloadDescription")
    })
  }

  return (
    <div>
      {downloadState.isDownloading && (
        <CancelPullingModel
          cancelDownloadModel={cancelDownloadModel}
          modelName={downloadState.modelName}
        />
      )}

      <div>
        {status === "pending" && <Skeleton paragraph={{ rows: 8 }} />}

        {status === "success" && (
          <div className="overflow-x-auto">
            <Table
              columns={[
                {
                  title: t("openai:manageModels.columns.nickname"),
                  dataIndex: "nickname",
                  key: "nickname",
                  render: (text: string, record: any) => (
                    <div className="flex items-center gap-2">
                      {record.avatar && (
                        <Avatar
                          size="small"
                          src={record.avatar}
                          alt={record.nickname}
                        />
                      )}
                      <span>{text}</span>
                      <button
                        onClick={() => {
                          setModel({
                            model_id: record.model,
                            model_name: record.nickname,
                            model_avatar: record.avatar
                          })
                          setOpenNicknameModal(true)
                        }}>
                        <Pencil className="size-3" />
                      </button>
                    </div>
                  )
                },
                {
                  title: "Model ID",
                  dataIndex: "name",
                  key: "name"
                },
                {
                  title: t("manageModels.columns.digest"),
                  dataIndex: "digest",
                  key: "digest",
                  render: (text: string) => (
                    <Tooltip title={text}>
                      <Tag
                        className="cursor-pointer"
                        color="blue">{`${text?.slice(0, 5)}...${text?.slice(-4)}`}</Tag>
                    </Tooltip>
                  )
                },
                {
                  title: t("manageModels.columns.modifiedAt"),
                  dataIndex: "modified_at",
                  key: "modified_at",
                  render: (text: string) => dayjs(text).fromNow(true)
                },
                {
                  title: t("manageModels.columns.size"),
                  dataIndex: "size",
                  key: "size",
                  render: (text: number) => bytePerSecondFormatter(text)
                },
                {
                  title: t("manageModels.columns.actions"),
                  render: (_, record) => (
                    <div className="flex gap-2">
                      <Tooltip title={t("common:modelSettings.label")}>
                        <button
                          onClick={() => {
                            setModel({
                              model_id: record.model
                            })
                            setOpenSettingsModal(true)
                          }}
                          className="text-gray-700 dark:text-gray-400">
                          <Settings className="size-4" />
                        </button>
                      </Tooltip>
                      <Tooltip title={t("manageModels.tooltip.delete")}>
                        <button
                          onClick={() => {
                            if (
                              window.confirm(t("manageModels.confirm.delete"))
                            ) {
                              deleteOllamaModel(record.model)
                              if (
                                selectedModel &&
                                selectedModel === record.model
                              ) {
                                setSelectedModel(null)
                              }
                            }
                          }}
                          className="text-red-500 dark:text-red-400">
                          <Trash2 className="size-4" />
                        </button>
                      </Tooltip>

                      <Tooltip title={t("manageModels.tooltip.repull")}>
                        <button
                          onClick={() => {
                            if (
                              window.confirm(t("manageModels.confirm.repull"))
                            ) {
                              pullOllamaModel(record.model)
                            }
                          }}
                          className="text-gray-700 dark:text-gray-400">
                          <RotateCcw className="size-4" />
                        </button>
                      </Tooltip>
                    </div>
                  )
                }
              ]}
              expandable={{
                expandedRowRender: (record) => (
                  <Table
                    pagination={false}
                    columns={[
                      {
                        title: t("manageModels.expandedColumns.parentModel"),
                        key: "parent_model",
                        dataIndex: "parent_model"
                      },
                      {
                        title: t("manageModels.expandedColumns.format"),
                        key: "format",
                        dataIndex: "format"
                      },
                      {
                        title: t("manageModels.expandedColumns.family"),
                        key: "family",
                        dataIndex: "family"
                      },
                      {
                        title: t("manageModels.expandedColumns.parameterSize"),
                        key: "parameter_size",
                        dataIndex: "parameter_size"
                      },
                      {
                        title: t(
                          "manageModels.expandedColumns.quantizationLevel"
                        ),
                        key: "quantization_level",
                        dataIndex: "quantization_level"
                      }
                    ]}
                    dataSource={[record.details]}
                    locale={{
                      emptyText: t("common:noData")
                    }}
                  />
                ),
                defaultExpandAllRows: false
              }}
              bordered
              dataSource={data}
              rowKey={(record) => `${record.model}-${record.digest}`}
              footer={() => (
                <div>
                  <a
                    href="https://ollama.com/search"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-[12px] text-neutral-50 dark:text-neutral-400 hover:text-neutral-300 dark:hover:text-neutral-200 "
                    style={{ textDecoration: "none" }}>
                    {t(
                      "manageModels.getMoreModels",
                      "Get more models from Ollama"
                    )}

                    <ExternalLink className="size-[12px] " />
                  </a>
                </div>
              )}
            />
          </div>
        )}
      </div>
      <ModelNickModelNicknameModal
        model_id={model.model_id}
        open={openNicknameModal}
        setOpen={setOpenNicknameModal}
        model_name={model.model_name}
        model_avatar={model.model_avatar}
      />

      <AddUpdateModelSettings
        model_id={model.model_id}
        open={openSettingsModal}
        setOpen={setOpenSettingsModal}
      />
    </div>
  )
}

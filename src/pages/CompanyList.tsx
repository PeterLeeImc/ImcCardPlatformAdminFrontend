import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Checkbox, Layout, Modal, Space, Table, Tag, message } from 'antd'
import {
  ApartmentOutlined,
  DeleteOutlined,
  EditOutlined,
  StarFilled,
  StarOutlined,
  UndoOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { apiClient, isAdvisorRole } from '../api/client'
import type { CompanyListItem, LogPage } from '../types'
import { PUNCH_METHOD_OPTIONS } from '../types'
import { imcCustomerDetailUrl } from '../utils/imcLinks'
import { compareNumbers, compareStrings } from '../utils/tableSort'
import PageHeader from '../components/PageHeader'
import ActionIcon from '../components/ActionIcon'

const PAGE_SIZE = 20

export default function CompanyList() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<LogPage<CompanyListItem>>()
  const [page, setPage] = useState(0)
  const [includeHidden, setIncludeHidden] = useState(false)

  const fetchCompanies = useCallback(async (targetPage: number, showHidden: boolean) => {
    setLoading(true)
    try {
      const res = await apiClient.get<LogPage<CompanyListItem>>('/admin/companies', {
        params: { page: targetPage, size: PAGE_SIZE, includeHidden: showHidden },
      })
      setData(res.data)
    } catch (err) {
      const axiosErr = err as { response?: { data?: string } }
      message.error(axiosErr.response?.data ?? '載入客戶清單失敗')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCompanies(page, includeHidden)
  }, [page, includeHidden, fetchCompanies])

  const handleSetTemplate = (record: CompanyListItem) => {
    Modal.confirm({
      title: '確定要把這家客戶設為樣板客戶？',
      content: (
        <>
          客戶：{record.chName}
          <br />
          全系統同一時間只會有一家樣板客戶，設定後原本的樣板客戶會自動取消。
          <br />
          其他客戶可以在「假別維護」「加班別維護」畫面選擇從樣板客戶複製設定當起始值。
        </>
      ),
      onOk: async () => {
        try {
          await apiClient.post(`/admin/companies/${record.id}/set-template`)
          message.success('已設為樣板客戶')
          fetchCompanies(page, includeHidden)
        } catch (err) {
          const axiosErr = err as { response?: { data?: string } }
          message.error(axiosErr.response?.data ?? '設定失敗')
        }
      },
    })
  }

  const handleUnsetTemplate = (record: CompanyListItem) => {
    Modal.confirm({
      title: '確定要取消這家客戶的樣板客戶標記？',
      content: `客戶：${record.chName}`,
      onOk: async () => {
        try {
          await apiClient.post(`/admin/companies/${record.id}/unset-template`)
          message.success('已取消樣板客戶標記')
          fetchCompanies(page, includeHidden)
        } catch (err) {
          const axiosErr = err as { response?: { data?: string } }
          message.error(axiosErr.response?.data ?? '設定失敗')
        }
      },
    })
  }

  const handleDelete = (record: CompanyListItem) => {
    Modal.confirm({
      title: isAdvisorRole() ? '確定要隱藏這家客戶？' : '確定要刪除這家客戶？',
      content: isAdvisorRole()
        ? `客戶編號：${record.companyNum}，隱藏後系統管理者/系統使用者可以還原。`
        : `客戶編號：${record.companyNum}`,
      okType: 'danger',
      onOk: async () => {
        try {
          await apiClient.delete(`/admin/companies/${record.id}`)
          message.success(isAdvisorRole() ? '已隱藏' : '刪除成功')
          fetchCompanies(page, includeHidden)
        } catch (err) {
          const axiosErr = err as { response?: { data?: string } }
          message.error(axiosErr.response?.data ?? '刪除失敗')
        }
      },
    })
  }

  const handleRestore = (record: CompanyListItem) => {
    Modal.confirm({
      title: '確定要還原這家客戶？',
      content: `客戶編號：${record.companyNum}`,
      onOk: async () => {
        try {
          await apiClient.post(`/admin/companies/${record.id}/restore`)
          message.success('已還原')
          fetchCompanies(page, includeHidden)
        } catch (err) {
          const axiosErr = err as { response?: { data?: string } }
          message.error(axiosErr.response?.data ?? '還原失敗')
        }
      },
    })
  }

  const columns: ColumnsType<CompanyListItem> = [
    {
      title: '客戶編號',
      dataIndex: 'companyNum',
      key: 'companyNum',
      render: (v: string) => (
        <a href={imcCustomerDetailUrl(v)} target="_blank" rel="noreferrer">
          {v}
        </a>
      ),
      sorter: (a, b) => compareStrings(a.companyNum, b.companyNum),
    },
    {
      title: '客戶名稱',
      dataIndex: 'chName',
      key: 'chName',
      render: (v: string, record) => (
        <>
          {v}
          {record.template && (
            <Tag color="gold" style={{ marginLeft: 8 }}>
              樣板客戶
            </Tag>
          )}
          {record.hidden && (
            <Tag color="default" style={{ marginLeft: 8 }}>
              已隱藏
            </Tag>
          )}
        </>
      ),
      sorter: (a, b) => compareStrings(a.chName, b.chName),
    },
    {
      title: '簡稱',
      dataIndex: 'name4Short',
      key: 'name4Short',
      sorter: (a, b) => compareStrings(a.name4Short, b.name4Short),
    },
    {
      title: '客戶地址',
      dataIndex: 'addr',
      key: 'addr',
      render: (v: string | null) => v ?? '-',
      sorter: (a, b) => compareStrings(a.addr, b.addr),
    },
    {
      title: '打卡方式',
      dataIndex: 'punchMethod',
      key: 'punchMethod',
      render: (v: string | null) => PUNCH_METHOD_OPTIONS.find((o) => o.value === v)?.label ?? v ?? '-',
      sorter: (a, b) =>
        compareStrings(
          PUNCH_METHOD_OPTIONS.find((o) => o.value === a.punchMethod)?.label ?? a.punchMethod,
          PUNCH_METHOD_OPTIONS.find((o) => o.value === b.punchMethod)?.label ?? b.punchMethod,
        ),
    },
    {
      title: 'GPS打卡有效半徑(公尺)',
      dataIndex: 'gpsRadiusMeters',
      key: 'gpsRadiusMeters',
      render: (v: number | null) => v ?? '-',
      sorter: (a, b) => compareNumbers(a.gpsRadiusMeters, b.gpsRadiusMeters),
    },
    {
      title: '備註',
      dataIndex: 'descr',
      key: 'descr',
      ellipsis: true,
      render: (v: string | null) => v ?? '-',
      sorter: (a, b) => compareStrings(a.descr, b.descr),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) =>
        record.hidden ? (
          <Space size="small">
            <ActionIcon title="還原" icon={<UndoOutlined />} onClick={() => handleRestore(record)} />
          </Space>
        ) : (
          <Space size="small">
            <ActionIcon
              title="個案維護/班表"
              icon={<ApartmentOutlined />}
              onClick={() => navigate(`/dispatch-cases?companyId=${record.id}`)}
            />
            <ActionIcon title="編輯" icon={<EditOutlined />} onClick={() => navigate(`/companies/${record.id}`)} />
            {record.template ? (
              <ActionIcon title="取消樣板" icon={<StarFilled />} onClick={() => handleUnsetTemplate(record)} />
            ) : (
              <ActionIcon title="設為樣板" icon={<StarOutlined />} onClick={() => handleSetTemplate(record)} />
            )}
            <ActionIcon title="刪除" icon={<DeleteOutlined />} danger onClick={() => handleDelete(record)} />
          </Space>
        ),
    },
  ]

  return (
    <Layout style={{ minHeight: '100vh', background: '#f5f6f8' }}>
      <PageHeader
        title="客戶維護"
        actions={
          <Button type="primary" onClick={() => navigate('/companies/new')}>
            新增客戶
          </Button>
        }
      />
      <div style={{ padding: 24 }}>
        {!isAdvisorRole() && (
          <Checkbox
            checked={includeHidden}
            onChange={(e) => {
              setIncludeHidden(e.target.checked)
              setPage(0)
            }}
            style={{ marginBottom: 16 }}
          >
            顯示已隱藏項目
          </Checkbox>
        )}
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={data?.content ?? []}
          pagination={{
            current: page + 1,
            pageSize: PAGE_SIZE,
            total: data?.totalElements ?? 0,
            showSizeChanger: false,
            onChange: (nextPage) => setPage(nextPage - 1),
          }}
        />
      </div>
    </Layout>
  )
}

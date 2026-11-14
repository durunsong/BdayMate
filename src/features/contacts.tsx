'use client';
import Link from 'next/link';
import { useState } from 'react';
import {
  Archive,
  ArrowDownToLine,
  ArrowUpFromLine,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Avatar,
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  Input,
  Modal,
  PageHeading,
  Panel,
  Select,
} from '@/components/ui';
import { birthdayLabel, shortDate } from '@/features/contact-display';
import { relationships, type Workspace } from '@/lib/types';
import { useAction } from '@/features/use-action';
export function Contacts({
  workspace,
  initialTag = '',
  initialRelationship = '',
}: {
  workspace: Workspace;
  initialTag?: string;
  initialRelationship?: string;
}) {
  const [search, setSearch] = useState('');
  const [relationship, setRelationship] = useState(initialRelationship);
  const [tag, setTag] = useState(initialTag);
  const [month, setMonth] = useState('');
  const [sort, setSort] = useState('birthday');
  const [archived, setArchived] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [deleting, setDeleting] = useState<string[] | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [csv, setCsv] = useState('');
  const [fileName, setFileName] = useState('');
  const { run, pending } = useAction();
  const filtered = workspace.contacts
    .filter(
      (c) =>
        !!c.archivedAt === archived &&
        (!search || c.name.toLowerCase().includes(search.toLowerCase())) &&
        (!relationship || c.relationship === relationship) &&
        (!tag || c.tags.some((t) => t.id === tag)) &&
        (!month ||
          (c.birthdayType === 'SOLAR' ? c.solarMonth : c.lunarMonth) ===
            Number(month)),
    )
    .sort((a, b) =>
      sort === 'created'
        ? b.createdAt.localeCompare(a.createdAt)
        : sort === 'name'
          ? a.name.localeCompare(b.name, 'zh-CN')
          : (a.next?.daysUntil ?? Infinity) - (b.next?.daysUntil ?? Infinity),
    );
  const chosen = selected.filter((id) => filtered.some((c) => c.id === id));
  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  }
  async function bulk(
    operation: 'archive' | 'restore' | 'delete',
    ids = chosen,
  ) {
    const result = await run('bulkContacts', { ids, operation });
    if (result.ok) {
      setSelected([]);
      setDeleting(null);
    }
  }
  async function loadFile(file?: File) {
    if (!file) return;
    if (file.size > 2_000_000) {
      toast.error('CSV 文件不能超过 2MB');
      return;
    }
    try {
      setCsv(await file.text());
      setFileName(file.name);
    } catch {
      toast.error('无法读取文件，请重新选择');
    }
  }
  return (
    <>
      <PageHeading
        title="重要的人，都在这里"
        description={`共 ${workspace.contacts.filter((c) => !c.archivedAt).length} 位联系人，每一位都值得被记得。`}
      >
        <Button variant="secondary" onClick={() => setImportOpen(true)}>
          <ArrowUpFromLine size={15} />
          导入
        </Button>
        <Button variant="secondary" asChild>
          <a href="/api/export/contacts" download>
            <ArrowDownToLine size={15} />
            导出
          </a>
        </Button>
        <Button asChild>
          <Link href="/contacts/new">
            <Plus size={16} />
            添加联系人
          </Link>
        </Button>
      </PageHeading>
      <Panel>
        <div className="toolbar">
          <div className="search-input">
            <Search size={17} />
            <Input
              aria-label="搜索联系人姓名"
              placeholder="搜索一个名字…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select
            aria-label="筛选关系"
            value={relationship}
            onChange={(e) => setRelationship(e.target.value)}
          >
            <option value="">全部关系</option>
            {Object.entries(relationships).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </Select>
          <Select
            aria-label="筛选标签"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
          >
            <option value="">全部标签</option>
            {workspace.tags.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
          <Select
            aria-label="筛选生日月份"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          >
            <option value="">全部月份</option>
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i} value={i + 1}>
                {i + 1} 月
              </option>
            ))}
          </Select>
          <Select
            aria-label="排序方式"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="birthday">按生日排序</option>
            <option value="created">最近添加</option>
            <option value="name">按姓名排序</option>
          </Select>
          <div className="filter-status">
            <button
              className={!archived ? 'active' : ''}
              onClick={() => {
                setArchived(false);
                setSelected([]);
              }}
            >
              全部联系人
            </button>
            <button
              className={archived ? 'active' : ''}
              onClick={() => {
                setArchived(true);
                setSelected([]);
              }}
            >
              已归档
            </button>
          </div>
        </div>
        {chosen.length > 0 && (
          <div className="bulk-bar">
            <span>已选择 {chosen.length} 位联系人</span>
            <div className="row">
              <Button
                variant="secondary"
                size="sm"
                disabled={pending}
                onClick={() => void bulk(archived ? 'restore' : 'archive')}
              >
                {archived ? <RotateCcw size={14} /> : <Archive size={14} />}
                {archived ? '恢复' : '归档'}
              </Button>
              <Button
                variant="danger"
                size="sm"
                disabled={pending}
                onClick={() => setDeleting(chosen)}
              >
                <Trash2 size={14} />
                删除
              </Button>
            </div>
          </div>
        )}
        {filtered.length ? (
          <>
            <p className="mobile-table-hint">
              左右滑动，查看生日、倒计时和更多操作
            </p>
            <div
              className="table-wrap contacts-table-scroll"
              role="region"
              aria-label="联系人列表，可左右滚动查看全部列"
              tabIndex={0}
            >
              <table className="data-table">
                <thead>
                  <tr>
                    <th>
                      <input
                        type="checkbox"
                        aria-label="选择当前筛选全部联系人"
                        checked={chosen.length === filtered.length}
                        onChange={(e) =>
                          setSelected(
                            e.target.checked ? filtered.map((c) => c.id) : [],
                          )
                        }
                      />
                    </th>
                    <th>联系人</th>
                    <th>生日</th>
                    <th className="mobile-hide">关系 / 标签</th>
                    <th>倒计时</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`选择${c.name}`}
                          checked={chosen.includes(c.id)}
                          onChange={() => toggle(c.id)}
                        />
                      </td>
                      <td>
                        <Link
                          href={`/contacts/${c.id}`}
                          className="contact-cell contact-link"
                        >
                          <Avatar name={c.name} src={c.avatar} />
                          <div>
                            <strong>{c.name}</strong>
                            <p>{c.email || relationships[c.relationship]}</p>
                          </div>
                        </Link>
                      </td>
                      <td className="contact-birthday-cell">
                        <div>{birthdayLabel(c)}</div>
                        <p className="muted small">
                          {c.birthYear
                            ? `${c.birthYear} 年出生`
                            : c.birthdayType === 'LUNAR'
                              ? '每年自动换算'
                              : '公历生日'}
                        </p>
                      </td>
                      <td className="mobile-hide">
                        <div className="tag-list">
                          <Badge>{relationships[c.relationship]}</Badge>
                          {c.tags.map((t) => (
                            <Badge key={t.id}>
                              <span
                                className="color-dot"
                                style={{ background: t.color }}
                              />
                              {t.name}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td>
                        {c.next ? (
                          <>
                            <Badge
                              tone={
                                c.next.daysUntil === 0
                                  ? 'warm'
                                  : c.next.daysUntil <= 7
                                    ? 'primary'
                                    : 'neutral'
                              }
                            >
                              {c.next.daysUntil === 0
                                ? '今天生日'
                                : `${c.next.daysUntil} 天后`}
                            </Badge>
                            <p className="muted small">
                              {shortDate(c.next.date)}
                            </p>
                          </>
                        ) : (
                          <span className="danger-text">日期待检查</span>
                        )}
                      </td>
                      <td>
                        <div className="table-actions">
                          <Button asChild variant="ghost" size="icon">
                            <Link
                              href={`/contacts/${c.id}/edit`}
                              aria-label={`编辑${c.name}`}
                            >
                              <Pencil size={15} />
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={pending}
                            aria-label={`${archived ? '恢复' : '归档'}${c.name}`}
                            onClick={() =>
                              void run('archiveContact', {
                                id: c.id,
                                archived: !archived,
                              })
                            }
                          >
                            {archived ? (
                              <RotateCcw size={15} />
                            ) : (
                              <Archive size={15} />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={pending}
                            aria-label={`删除${c.name}`}
                            onClick={() => setDeleting([c.id])}
                          >
                            <Trash2 size={15} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="table-foot">
              <span>
                显示 {filtered.length} 位{archived ? '已归档' : ''}联系人
              </span>
              <span>生日按 {workspace.timeZone} 计算</span>
            </div>
          </>
        ) : (
          <EmptyState
            title={
              search || relationship || tag || month
                ? '没有找到匹配的联系人'
                : archived
                  ? '还没有归档的联系人'
                  : '记住生日，也记住在乎'
            }
            description={
              search || relationship || tag || month
                ? '换一个名字，或调整筛选条件试试。'
                : archived
                  ? '归档的联系人会保留记录，恢复后可以继续收到提醒。'
                  : '从家人或朋友开始，添加你的第一位联系人。'
            }
            href={!archived ? '/contacts/new' : undefined}
            action={!archived ? '添加联系人' : undefined}
            icon={<Users size={29} />}
          />
        )}
      </Panel>
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`删除 ${deleting?.length ?? 0} 位联系人？`}
        description="相关的礼物、独立提醒和未发送任务也将被移除，此操作无法撤销。"
        pending={pending}
        onConfirm={() => bulk('delete', deleting ?? [])}
      />
      <Modal
        open={importOpen}
        onOpenChange={setImportOpen}
        title="导入生日联系人"
        description="选择 UTF-8 编码的 CSV 文件。导入前会校验所有行，错误信息会标明位置。"
      >
        <label className="field">
          <span>CSV 文件</span>
          <Input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => void loadFile(e.target.files?.[0])}
          />
        </label>
        <div className="import-help">
          推荐先导出现有联系人，使用相同表头填写。必填字段：name、birthdayType；relationship
          可选，默认 FRIEND（朋友）。公历填写 solarMonth / solarDay，农历填写
          lunarMonth / lunarDay。
          <br />
          <a className="text-link" href="/api/export/contacts" download>
            下载 CSV 表头与现有联系人
          </a>
        </div>
        {fileName && <p className="small muted">已选择：{fileName}</p>}
        <div className="form-actions">
          <Button variant="secondary" onClick={() => setImportOpen(false)}>
            取消
          </Button>
          <Button
            disabled={!csv}
            loading={pending}
            onClick={async () => {
              const result = await run('importContacts', { csv });
              if (result.ok) {
                setImportOpen(false);
                setCsv('');
                setFileName('');
              }
            }}
          >
            开始导入
          </Button>
        </div>
      </Modal>
    </>
  );
}

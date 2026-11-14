'use client';
import { useState, type FormEvent } from 'react';
import { Check, Copy, Heart, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeading,
  Panel,
  Select,
  Textarea,
} from '@/components/ui';
import { relationships, type Relationship, type Workspace } from '@/lib/types';
import { useAction } from '@/features/use-action';
type Wish = {
  id: string;
  title: string;
  content: string;
  relationship: Relationship;
};
export const defaultWishes: Wish[] = [
  {
    id: 'default-family',
    title: '把爱放进平常日子',
    relationship: 'FAMILY',
    content:
      '生日快乐！愿你每一天都平安顺遂，吃得香、睡得好，心里常有欢喜。往后的岁岁年年，我们一起慢慢过。',
  },
  {
    id: 'default-friend',
    title: '一起长大，也一起快乐',
    relationship: 'FRIEND',
    content:
      '又陪你走过了一年，真好。愿新的一岁，有想见的人、想做的事，也有说走就走的勇气。生日快乐，我的好朋友！',
  },
  {
    id: 'default-classmate',
    title: '青春里的老朋友',
    relationship: 'CLASSMATE',
    content:
      '从同窗到各自奔忙，不变的是那份熟悉与牵挂。祝你生日快乐，新的一岁继续做自己喜欢的事，遇见更多值得期待的风景。',
  },
  {
    id: 'default-colleague',
    title: '工作之外，也有好生活',
    relationship: 'COLLEAGUE',
    content:
      '生日快乐！愿新的一岁，工作顺心，生活有趣，努力都有回响，休息也能心安。感谢一直以来的并肩同行。',
  },
  {
    id: 'default-manager',
    title: '一份真诚的祝愿',
    relationship: 'MANAGER',
    content:
      '祝您生日快乐！感谢一直以来的指导与支持。愿您新的一岁事业顺遂、身体安康，生活中常有轻松与喜悦。',
  },
  {
    id: 'default-client',
    title: '把心意送到身边',
    relationship: 'CLIENT',
    content:
      '祝您生日快乐！愿新的一岁健康常伴、诸事顺意。感谢您的信任，愿未来的日子继续携手，共赴更好的风景。',
  },
  {
    id: 'default-partner',
    title: '同行之幸',
    relationship: 'PARTNER',
    content:
      '生日快乐！感谢一路同行与彼此支持。愿新的一岁，事业有新收获，生活有小确幸，每一份期待都慢慢成真。',
  },
  {
    id: 'default-other',
    title: '平凡日子里的一束光',
    relationship: 'OTHER',
    content:
      '愿新的一岁，有人惦记，有事可期，有勇气奔赴热爱，也有余裕享受日常。生日快乐，愿你被生活温柔以待。',
  },
];
export function Wishes({ workspace }: { workspace: Workspace }) {
  const [relationship, setRelationship] = useState('');
  const [tab, setTab] = useState('all');
  const [editing, setEditing] = useState<Wish | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Wish | null>(null);
  const [recording, setRecording] = useState<Wish | null>(null);
  const { run, pending } = useAction();
  const list = (
    tab === 'custom'
      ? workspace.wishes
      : tab === 'default'
        ? defaultWishes
        : [...workspace.wishes, ...defaultWishes]
  ).filter((w) => !relationship || w.relationship === relationship);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const result = await run('saveWish', {
      id: editing && editing !== 'new' ? editing.id : undefined,
      title: data.get('title'),
      content: data.get('content'),
      relationship: data.get('relationship'),
    });
    if (result.ok) setEditing(null);
  }
  async function copy(content: string) {
    try {
      await navigator.clipboard.writeText(content);
      toast.success('祝福语已复制，把心意送给对方吧');
    } catch {
      toast.error('复制失败，请手动选择文字复制');
    }
  }
  return (
    <>
      <PageHeading
        title="有些心意，值得好好说"
        description="收藏一句恰到好处的祝福，在重要的日子送给重要的人。"
      >
        <Button onClick={() => setEditing('new')}>
          <Plus size={16} />
          写一段祝福
        </Button>
      </PageHeading>
      <div
        className="row-between"
        style={{ marginBottom: 24, flexWrap: 'wrap' }}
      >
        <div className="filter-status">
          {[
            ['all', '全部祝福'],
            ['custom', '我的收藏'],
            ['default', '精选祝福'],
          ].map(([value, label]) => (
            <button
              key={value}
              className={tab === value ? 'active' : ''}
              onClick={() => setTab(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <Select
          aria-label="按关系筛选祝福"
          value={relationship}
          onChange={(e) => setRelationship(e.target.value)}
          style={{ width: 155 }}
        >
          <option value="">所有关系</option>
          {Object.entries(relationships).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </Select>
      </div>
      {list.length ? (
        <div className="wishes-grid">
          {list.map((wish) => (
            <Panel className="wish-card" key={wish.id}>
              <div className="wish-card-top">
                <h2>{wish.title}</h2>
                <Badge tone="primary">{relationships[wish.relationship]}</Badge>
              </div>
              <blockquote>{wish.content}</blockquote>
              <div className="wish-card-foot">
                <span className="small muted">
                  {wish.id.startsWith('default-')
                    ? 'BdayMate 精选'
                    : '我的收藏'}
                </span>
                <div className="row">
                  {!wish.id.startsWith('default-') && (
                    <>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`编辑${wish.title}`}
                        onClick={() => setEditing(wish)}
                      >
                        <Pencil size={14} />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`删除${wish.title}`}
                        onClick={() => setDeleting(wish)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`记录已发送${wish.title}`}
                    onClick={() => setRecording(wish)}
                  >
                    <Check size={16} />
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void copy(wish.content)}
                  >
                    <Copy size={14} />
                    复制
                  </Button>
                </div>
              </div>
            </Panel>
          ))}
        </div>
      ) : (
        <Panel>
          <EmptyState
            icon={<Heart size={29} />}
            title="收好你的第一份祝福"
            description="写下真心话，或先去精选祝福里找一点灵感。"
            action="写一段祝福"
            onAction={() => setEditing('new')}
          />
        </Panel>
      )}
      <Modal
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(null)}
        title={editing === 'new' ? '写一段生日祝福' : '编辑祝福语'}
        description="字数不必很多，真诚就很好。"
      >
        <form onSubmit={save} className="stack">
          <Field id="wish-title" label="祝福标题 *">
            <Input
              id="wish-title"
              name="title"
              required
              maxLength={100}
              defaultValue={editing && editing !== 'new' ? editing.title : ''}
            />
          </Field>
          <Field id="wish-relationship" label="适合的关系">
            <Select
              id="wish-relationship"
              name="relationship"
              defaultValue={
                editing && editing !== 'new' ? editing.relationship : 'FRIEND'
              }
            >
              {Object.entries(relationships).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="wish-content" label="祝福内容 *">
            <Textarea
              id="wish-content"
              name="content"
              required
              maxLength={3000}
              rows={6}
              defaultValue={editing && editing !== 'new' ? editing.content : ''}
            />
          </Field>
          <div className="form-actions">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setEditing(null)}
            >
              取消
            </Button>
            <Button type="submit" loading={pending}>
              保存祝福语
            </Button>
          </div>
        </form>
      </Modal>
      <Modal
        open={!!recording}
        onOpenChange={(open) => !open && setRecording(null)}
        title="记录一份已送出的祝福"
        description="这里仅保存记录，不会向联系人发送消息或邮件。"
      >
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            if (
              (
                await run('recordWish', {
                  contactId: data.get('contactId'),
                  content: recording?.content,
                })
              ).ok
            )
              setRecording(null);
          }}
          className="stack"
        >
          <Field id="record-contact" label="送给哪位联系人">
            <Select
              id="record-contact"
              name="contactId"
              required
              defaultValue=""
            >
              <option value="" disabled>
                请选择联系人
              </option>
              {workspace.contacts
                .filter((c) => !c.archivedAt)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </Select>
          </Field>
          {!workspace.contacts.length && (
            <p className="field-hint">请先添加一位联系人。</p>
          )}
          <div className="form-actions">
            <Button
              type="submit"
              disabled={!workspace.contacts.length}
              loading={pending}
            >
              保存发送记录
            </Button>
          </div>
        </form>
      </Modal>
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="删除这段祝福语？"
        description="这条自定义祝福语将被永久删除。"
        pending={pending}
        onConfirm={async () => {
          if (deleting && (await run('deleteWish', { id: deleting.id })).ok)
            setDeleting(null);
        }}
      />
    </>
  );
}

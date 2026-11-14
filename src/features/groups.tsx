'use client';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { Pencil, Plus, Tags, Trash2 } from 'lucide-react';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeading,
  Panel,
  Textarea,
} from '@/components/ui';
import { relationships, type TagDTO, type Workspace } from '@/lib/types';
import { useAction } from '@/features/use-action';
const colors = [
  '#6366F1',
  '#8B5CF6',
  '#DB7093',
  '#D97745',
  '#C29A3A',
  '#42947B',
  '#468AB8',
  '#64748B',
];
export function Groups({ workspace }: { workspace: Workspace }) {
  const [editing, setEditing] = useState<TagDTO | 'new' | null>(null);
  const [deleting, setDeleting] = useState<TagDTO | null>(null);
  const [color, setColor] = useState(colors[0]);
  const { run, pending } = useAction();
  function edit(tag: TagDTO | 'new') {
    setEditing(tag);
    setColor(tag === 'new' ? colors[0] : tag.color);
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const result = await run('saveTag', {
      id: editing && editing !== 'new' ? editing.id : undefined,
      name: data.get('name'),
      description: data.get('description') || undefined,
      color,
    });
    if (result.ok) setEditing(null);
  }
  return (
    <>
      <PageHeading
        title="让每一种关系，有自己的颜色"
        description="关系帮你整理生活，标签帮你记住那些特别的细节。"
      >
        <Button onClick={() => edit('new')}>
          <Plus size={16} />
          创建标签
        </Button>
      </PageHeading>
      <div className="panel-heading" style={{ paddingLeft: 0, paddingTop: 0 }}>
        <h2>关系分组</h2>
        <span className="small muted">点击查看这个分组的联系人</span>
      </div>
      <div className="relationship-grid">
        {Object.entries(relationships).map(([key, label]) => (
          <Link
            href={`/contacts?relationship=${key}`}
            className="relationship-card"
            key={key}
          >
            <strong>{label}</strong>
            <span>
              {
                workspace.contacts.filter(
                  (c) => c.relationship === key && !c.archivedAt,
                ).length
              }
            </span>
          </Link>
        ))}
      </div>
      <div className="panel-heading" style={{ paddingLeft: 0 }}>
        <h2>我的标签</h2>
        <span className="small muted">{workspace.tags.length} 个标签</span>
      </div>
      {workspace.tags.length ? (
        <div className="tag-grid">
          {workspace.tags.map((tag) => (
            <Panel className="tag-card" key={tag.id}>
              <div className="row-between">
                <h3>
                  <span
                    className="color-dot"
                    style={{ background: tag.color }}
                  />
                  {tag.name}
                </h3>
                <div className="row">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`编辑${tag.name}`}
                    onClick={() => edit(tag)}
                  >
                    <Pencil size={15} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`删除${tag.name}`}
                    onClick={() => setDeleting(tag)}
                  >
                    <Trash2 size={15} />
                  </Button>
                </div>
              </div>
              <p>{tag.description || '为这一份特别的联系，留一个标记。'}</p>
              <div className="tag-card-foot">
                <span>{tag.count} 位联系人</span>
                <Link className="text-link" href={`/contacts?tag=${tag.id}`}>
                  查看联系人 →
                </Link>
              </div>
            </Panel>
          ))}
        </div>
      ) : (
        <Panel>
          <EmptyState
            icon={<Tags size={29} />}
            title="给重要的人，一个特别的标记"
            description="例如“需要准备礼物”“很久没联系”。一个联系人可以拥有多个标签。"
            action="创建第一个标签"
            onAction={() => edit('new')}
          />
        </Panel>
      )}
      <Modal
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(null)}
        title={editing === 'new' ? '创建一个新标签' : '编辑标签'}
        description="用颜色和一句描述，记住这份联系的独特之处。"
      >
        <form onSubmit={save} className="stack">
          <Field id="tag-name" label="标签名称 *">
            <Input
              id="tag-name"
              name="name"
              required
              maxLength={40}
              defaultValue={editing && editing !== 'new' ? editing.name : ''}
              placeholder="例如：需要准备礼物"
            />
          </Field>
          <div className="field">
            <label>标签颜色</label>
            <div className="color-picker">
              {colors.map((value) => (
                <button
                  type="button"
                  className={`color-choice ${color.toLowerCase() === value.toLowerCase() ? 'active' : ''}`}
                  style={{ background: value }}
                  key={value}
                  aria-label={`选择颜色 ${value}`}
                  aria-pressed={color.toLowerCase() === value.toLowerCase()}
                  onClick={() => setColor(value)}
                />
              ))}
            </div>
            <Input
              type="color"
              aria-label="自定义标签颜色"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              style={{ width: 75 }}
            />
          </div>
          <Field id="tag-description" label="标签描述">
            <Textarea
              id="tag-description"
              name="description"
              maxLength={300}
              defaultValue={
                editing && editing !== 'new' ? (editing.description ?? '') : ''
              }
              placeholder="这个标签，对你意味着什么？"
            />
          </Field>
          <div className="form-actions">
            <Button
              variant="secondary"
              type="button"
              onClick={() => setEditing(null)}
            >
              取消
            </Button>
            <Button type="submit" loading={pending}>
              保存标签
            </Button>
          </div>
        </form>
      </Modal>
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`删除“${deleting?.name}”？`}
        description="这会移除联系人与该标签的关联，联系人本身会被保留。"
        pending={pending}
        onConfirm={async () => {
          if (deleting && (await run('deleteTag', { id: deleting.id })).ok)
            setDeleting(null);
        }}
      />
    </>
  );
}

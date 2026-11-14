'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import {
  Archive,
  ArrowLeft,
  Bell,
  Check,
  Copy,
  ExternalLink,
  Gift,
  Heart,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Avatar,
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
import {
  relationships,
  type ContactDTO,
  type GiftDTO,
  type Workspace,
} from '@/lib/types';
import { birthdayLabel, shortDate } from '@/features/contact-display';
import { ContactReminderForm } from '@/features/reminders';
import { defaultWishes } from '@/features/wishes';
import { useAction } from '@/features/use-action';
const giftStates = {
  IDEA: '礼物灵感',
  PLANNED: '计划中',
  PURCHASED: '已购买',
  GIVEN: '已送出',
};
export function ContactDetail({
  workspace,
  contact,
}: {
  workspace: Workspace;
  contact: ContactDTO;
}) {
  const router = useRouter();
  const { run, pending } = useAction();
  const [deleting, setDeleting] = useState(false);
  const [gift, setGift] = useState<GiftDTO | 'new' | null>(null);
  const [deleteGift, setDeleteGift] = useState<GiftDTO | null>(null);
  const [wish, setWish] = useState('');
  const [wishModal, setWishModal] = useState(false);
  const gifts = workspace.gifts.filter((g) => g.contactId === contact.id);
  const wishRecords = workspace.wishRecords.filter(
    (record) => record.contactId === contact.id,
  );
  const suggested =
    workspace.wishes.find((w) => w.relationship === contact.relationship) ??
    defaultWishes.find((w) => w.relationship === contact.relationship)!;
  async function saveGift(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const result = await run('saveGift', {
      id: gift && gift !== 'new' ? gift.id : undefined,
      contactId: contact.id,
      name: data.get('name'),
      description: data.get('description') || undefined,
      budget: data.get('budget') || undefined,
      currency: data.get('currency'),
      purchaseUrl: data.get('purchaseUrl') || undefined,
      givenAt: data.get('givenAt') || undefined,
      status: data.get('status'),
    });
    if (result.ok) setGift(null);
  }
  async function copyWish() {
    try {
      await navigator.clipboard.writeText(suggested.content);
      toast.success('祝福已复制');
    } catch {
      toast.error('复制失败，请手动选择文字');
    }
  }
  return (
    <>
      <PageHeading
        title="一个名字，一份在乎"
        description="关于这个人的生日、心意和小计划。"
      >
        <Button asChild variant="secondary">
          <Link href="/contacts">
            <ArrowLeft size={15} />
            联系人
          </Link>
        </Button>
        <Button
          variant="secondary"
          loading={pending}
          onClick={() =>
            void run('archiveContact', {
              id: contact.id,
              archived: !contact.archivedAt,
            })
          }
        >
          {contact.archivedAt ? <RotateCcw size={15} /> : <Archive size={15} />}
          {contact.archivedAt ? '恢复' : '归档'}
        </Button>
        <Button asChild>
          <Link href={`/contacts/${contact.id}/edit`}>
            <Pencil size={15} />
            编辑
          </Link>
        </Button>
      </PageHeading>
      {contact.archivedAt && (
        <div className="status-callout">
          <Archive size={19} />
          <div>
            <strong>这位联系人已归档</strong>
            <p>生日记录会保留，恢复后可继续安排生日提醒。</p>
          </div>
        </div>
      )}
      {contact.birthdayError && (
        <div className="status-callout">
          <Bell size={19} />
          <div>
            <strong>生日日期需要检查</strong>
            <p>{contact.birthdayError}</p>
          </div>
        </div>
      )}
      <Panel>
        <div className="detail-header">
          <Avatar name={contact.name} src={contact.avatar} size="large" />
          <div className="detail-header-main">
            <h1>{contact.name}</h1>
            <div className="tag-list">
              <Badge tone="primary">
                {relationships[contact.relationship]}
              </Badge>
              {contact.tags.map((t) => (
                <Link key={t.id} href={`/contacts?tag=${t.id}`}>
                  <Badge>
                    <span
                      className="color-dot"
                      style={{ background: t.color }}
                    />
                    {t.name}
                  </Badge>
                </Link>
              ))}
            </div>
            <p className="birthday-meta" style={{ marginTop: 11 }}>
              {birthdayLabel(contact)}
              {contact.birthYear ? ` · ${contact.birthYear} 年出生` : ''}
            </p>
          </div>
          {contact.next && (
            <div className="detail-countdown">
              <strong>
                {contact.next.daysUntil === 0 ? '今天' : contact.next.daysUntil}
              </strong>
              <span>
                {contact.next.daysUntil === 0 ? '生日快乐' : '天后过生日'}
              </span>
              <p className="small muted">
                {shortDate(contact.next.date)}
                {contact.next.age != null ? ` · ${contact.next.age} 岁` : ''}
              </p>
            </div>
          )}
        </div>
      </Panel>
      <div className="detail-grid">
        <div className="stack">
          <Panel>
            <div className="panel-heading">
              <h2>关于 {contact.name}</h2>
              <Badge>
                {contact.birthdayType === 'LUNAR' ? '农历生日' : '公历生日'}
              </Badge>
            </div>
            <dl className="detail-fields">
              <div>
                <dt>邮箱</dt>
                <dd>{contact.email || '尚未填写'}</dd>
              </div>
              <div>
                <dt>手机号</dt>
                <dd>{contact.phone || '尚未填写'}</dd>
              </div>
              <div>
                <dt>性别</dt>
                <dd>
                  {contact.gender === 'MALE'
                    ? '男'
                    : contact.gender === 'FEMALE'
                      ? '女'
                      : contact.gender === 'OTHER'
                        ? '其他'
                        : '尚未填写'}
                </dd>
              </div>
              <div>
                <dt>庆祝规则</dt>
                <dd>
                  {contact.birthdayType === 'LUNAR'
                    ? contact.isLeapMonth
                      ? contact.lunarLeapPolicy === 'SKIP'
                        ? '没有对应闰月时跳过'
                        : '没有闰月时按普通月'
                      : '每年按农历换算'
                    : contact.solarMonth === 2 && contact.solarDay === 29
                      ? `平年按 ${contact.leapDayPolicy === 'MAR1' ? '3 月 1 日' : '2 月 28 日'}`
                      : '每年公历同日'}
                </dd>
              </div>
              <div className="full-width">
                <dt>记在心里的小事</dt>
                <dd>
                  {contact.notes ||
                    '还没有备注。可以记下爱好、喜欢的颜色，或一个想一起实现的小愿望。'}
                </dd>
              </div>
            </dl>
          </Panel>
          <Panel>
            <div className="panel-heading">
              <div>
                <h2>为 TA 准备的心意</h2>
                <p>礼物灵感与送礼记录</p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setGift('new')}
              >
                <Plus size={14} />
                添加礼物
              </Button>
            </div>
            {gifts.length ? (
              gifts.map((item) => (
                <div className="gift-item" key={item.id}>
                  <div>
                    <div className="row">
                      <h3>{item.name}</h3>
                      <Badge
                        tone={item.status === 'GIVEN' ? 'success' : 'primary'}
                      >
                        {giftStates[item.status]}
                      </Badge>
                    </div>
                    {item.description && <p>{item.description}</p>}
                    <p>
                      {item.budget
                        ? `${item.currency} ${Number(item.budget).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : '未设置预算'}
                      {item.givenAt ? ` · ${item.givenAt.slice(0, 10)}` : ''}
                    </p>
                    {item.purchaseUrl && (
                      <a
                        className="text-link"
                        href={item.purchaseUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        购买链接
                        <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                  <div className="row">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`编辑礼物${item.name}`}
                      onClick={() => setGift(item)}
                    >
                      <Pencil size={14} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`删除礼物${item.name}`}
                      onClick={() => setDeleteGift(item)}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState
                title="好礼物，来自平时的小观察"
                description="先记下一个灵感，生日到来时就不会手忙脚乱。"
                icon={<Gift size={28} />}
                action="记下礼物灵感"
                onAction={() => setGift('new')}
              />
            )}
          </Panel>
          <Panel>
            <div className="panel-heading">
              <h2>送出过的祝福</h2>
              <Badge>{wishRecords.length} 条记录</Badge>
            </div>
            {wishRecords.length ? (
              wishRecords.map((record) => (
                <div className="queue-item" key={record.id}>
                  <p className="small muted">
                    {new Intl.DateTimeFormat('zh-CN', {
                      timeZone: workspace.timeZone,
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    }).format(new Date(record.sentAt))}
                  </p>
                  <p
                    style={{
                      whiteSpace: 'pre-wrap',
                      lineHeight: 1.9,
                      marginTop: 9,
                    }}
                  >
                    {record.content}
                  </p>
                </div>
              ))
            ) : (
              <p className="dropdown-empty">
                送出祝福后，点击“记录已发送”，留下一份温暖的回忆。
              </p>
            )}
          </Panel>
        </div>
        <div className="stack">
          <Panel>
            <div className="panel-heading">
              <h2>生日提醒</h2>
              <Bell size={17} className="muted" />
            </div>
            <ContactReminderForm workspace={workspace} contact={contact} />
          </Panel>
          <Panel>
            <div className="panel-heading">
              <h2>一句暖心祝福</h2>
              <Heart size={17} className="muted" />
            </div>
            <div className="inline-form">
              <p style={{ fontSize: 13, lineHeight: 1.95, color: '#64748b' }}>
                {suggested.content}
              </p>
              <div className="form-actions">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void copyWish()}
                >
                  <Copy size={14} />
                  复制祝福
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setWish(suggested.content);
                    setWishModal(true);
                  }}
                >
                  <Check size={14} />
                  记录已发送
                </Button>
              </div>
              <Link
                href="/wishes"
                className="text-link"
                style={{ marginTop: 18 }}
              >
                找一句更合适的祝福 →
              </Link>
            </div>
          </Panel>
          <Button
            variant="ghost"
            className="danger-text"
            onClick={() => setDeleting(true)}
          >
            <Trash2 size={14} />
            删除这位联系人
          </Button>
        </div>
      </div>
      <Modal
        open={!!gift}
        onOpenChange={(open) => !open && setGift(null)}
        title={gift === 'new' ? '记下一份礼物灵感' : '编辑礼物'}
        description="用一点准备，把平凡的日子变特别。"
      >
        <form onSubmit={saveGift} className="form-grid">
          <Field id="gift-name" label="礼物名称 *" className="full-width">
            <Input
              id="gift-name"
              name="name"
              required
              maxLength={100}
              defaultValue={gift && gift !== 'new' ? gift.name : ''}
            />
          </Field>
          <Field id="gift-budget" label="预算">
            <Input
              id="gift-budget"
              name="budget"
              type="number"
              min="0"
              step="0.01"
              defaultValue={gift && gift !== 'new' ? (gift.budget ?? '') : ''}
              placeholder="可选"
            />
          </Field>
          <Field id="gift-currency" label="币种">
            <Select
              id="gift-currency"
              name="currency"
              defaultValue={gift && gift !== 'new' ? gift.currency : 'CNY'}
            >
              {['CNY', 'USD', 'HKD', 'EUR', 'GBP', 'JPY'].map((currency) => (
                <option key={currency}>{currency}</option>
              ))}
            </Select>
          </Field>
          <Field id="gift-status" label="送礼状态">
            <Select
              id="gift-status"
              name="status"
              defaultValue={gift && gift !== 'new' ? gift.status : 'IDEA'}
            >
              {Object.entries(giftStates).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="gift-date" label="送礼日期">
            <Input
              id="gift-date"
              name="givenAt"
              type="date"
              defaultValue={
                gift && gift !== 'new' ? (gift.givenAt?.slice(0, 10) ?? '') : ''
              }
            />
          </Field>
          <Field id="gift-url" label="购买链接" className="full-width">
            <Input
              id="gift-url"
              name="purchaseUrl"
              type="url"
              placeholder="https://…"
              defaultValue={
                gift && gift !== 'new' ? (gift.purchaseUrl ?? '') : ''
              }
            />
          </Field>
          <Field id="gift-description" label="礼物备注" className="full-width">
            <Textarea
              id="gift-description"
              name="description"
              maxLength={1000}
              defaultValue={
                gift && gift !== 'new' ? (gift.description ?? '') : ''
              }
            />
          </Field>
          <div className="form-actions full-width">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setGift(null)}
            >
              取消
            </Button>
            <Button type="submit" loading={pending}>
              保存礼物
            </Button>
          </div>
        </form>
      </Modal>
      <Modal
        open={wishModal}
        onOpenChange={setWishModal}
        title="记录已送出的祝福"
        description="仅保存记录，不会向联系人自动发送消息。"
      >
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (
              (
                await run('recordWish', {
                  contactId: contact.id,
                  content: wish,
                })
              ).ok
            )
              setWishModal(false);
          }}
        >
          <Field id="sent-wish" label={`送给${contact.name}的话`}>
            <Textarea
              id="sent-wish"
              value={wish}
              onChange={(e) => setWish(e.target.value)}
              required
              maxLength={3000}
              rows={6}
            />
          </Field>
          <div className="form-actions">
            <Button type="submit" loading={pending}>
              保存祝福记录
            </Button>
          </div>
        </form>
      </Modal>
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`删除${contact.name}？`}
        description="这个人的生日、礼物、提醒和祝福记录将被永久移除。"
        pending={pending}
        onConfirm={async () => {
          if ((await run('deleteContact', { id: contact.id })).ok)
            router.push('/contacts');
        }}
      />
      <ConfirmDialog
        open={!!deleteGift}
        onOpenChange={(open) => !open && setDeleteGift(null)}
        title="删除这份礼物记录？"
        description="删除后无法恢复这条礼物记录。"
        pending={pending}
        onConfirm={async () => {
          if (deleteGift && (await run('deleteGift', { id: deleteGift.id })).ok)
            setDeleteGift(null);
        }}
      />
    </>
  );
}

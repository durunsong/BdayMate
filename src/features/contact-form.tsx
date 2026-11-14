'use client';
import Link from 'next/link';
import { useProgressRouter as useRouter } from '@/lib/navigation';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ArrowLeft,
  CalendarDays,
  Info,
  Save,
  Tags,
  UserRound,
} from 'lucide-react';
import {
  Avatar,
  Button,
  Field,
  Input,
  PageHeading,
  Panel,
  Select,
  Textarea,
} from '@/components/ui';
import { relationships, type ContactDTO, type Workspace } from '@/lib/types';
import { useAction } from '@/features/use-action';
import {
  contactFormSchema,
  type ContactFormValues,
} from '@/features/validation';
export function ContactForm({
  workspace,
  contact,
}: {
  workspace: Workspace;
  contact?: ContactDTO;
}) {
  const router = useRouter();
  const { run, pending } = useAction();
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      name: contact?.name ?? '',
      avatar: contact?.avatar ?? '',
      gender: contact?.gender ?? '',
      birthdayType: contact?.birthdayType ?? 'SOLAR',
      birthYear: contact?.birthYear?.toString() ?? '',
      solarMonth: contact?.solarMonth?.toString() ?? '1',
      solarDay: contact?.solarDay?.toString() ?? '1',
      lunarMonth: contact?.lunarMonth?.toString() ?? '1',
      lunarDay: contact?.lunarDay?.toString() ?? '1',
      isLeapMonth: contact?.isLeapMonth ?? false,
      leapDayPolicy: contact?.leapDayPolicy ?? 'FEB28',
      lunarLeapPolicy: contact?.lunarLeapPolicy ?? 'REGULAR',
      relationship: contact?.relationship ?? 'FRIEND',
      email: contact?.email ?? '',
      phone: contact?.phone ?? '',
      notes: contact?.notes ?? '',
      tagIds: contact?.tags.map((t) => t.id) ?? [],
    },
  });
  const values = useWatch({ control });
  async function save(values: ContactFormValues) {
    const result = await run('saveContact', {
      ...values,
      id: contact?.id,
      birthYear: values.birthYear ? Number(values.birthYear) : undefined,
      solarMonth:
        values.birthdayType === 'SOLAR' ? Number(values.solarMonth) : undefined,
      solarDay:
        values.birthdayType === 'SOLAR' ? Number(values.solarDay) : undefined,
      lunarMonth:
        values.birthdayType === 'LUNAR' ? Number(values.lunarMonth) : undefined,
      lunarDay:
        values.birthdayType === 'LUNAR' ? Number(values.lunarDay) : undefined,
      isLeapMonth: values.birthdayType === 'LUNAR' && values.isLeapMonth,
      avatar: values.avatar || undefined,
      email: values.email || undefined,
      phone: values.phone || undefined,
      gender: values.gender || undefined,
      notes: values.notes || undefined,
    });
    if (result.ok)
      router.push(contact ? `/contacts/${contact.id}` : '/contacts');
  }
  const fieldMonth =
    values.birthdayType === 'LUNAR' ? 'lunarMonth' : 'solarMonth';
  const fieldDay = values.birthdayType === 'LUNAR' ? 'lunarDay' : 'solarDay';
  return (
    <div className="contact-form-container">
      <PageHeading
        title={contact ? '编辑联系人' : '记下一个重要的生日'}
        description={
          contact
            ? '更新这一份在乎，下一次提醒也会随之调整。'
            : '不必记住所有日期，把重要的人留在这里。'
        }
      >
        <Button asChild variant="secondary">
          <Link href={contact ? `/contacts/${contact.id}` : '/contacts'}>
            <ArrowLeft size={16} />
            返回
          </Link>
        </Button>
      </PageHeading>
      <Panel>
        <form onSubmit={handleSubmit(save)} noValidate>
          <div className="form-intro">
            <Avatar
              name={values.name || '新'}
              src={values.avatar}
              size="large"
            />
            <div>
              <h2>{values.name || '你的重要联系人'}</h2>
              <p>出生年份可以留空，生日仍会如期提醒。</p>
            </div>
          </div>
          <fieldset disabled={pending} className="contents">
            <section className="form-section">
              <div className="form-section-heading">
                <UserRound size={18} />
                <h2>基本信息</h2>
              </div>
              <div className="form-grid">
                <Field id="name" label="姓名 *" error={errors.name?.message}>
                  <Input
                    id="name"
                    autoComplete="name"
                    placeholder="想要记住生日的人"
                    {...register('name')}
                    aria-invalid={!!errors.name}
                  />
                </Field>
                <Field id="relationship" label="你们的关系 *">
                  <Select id="relationship" {...register('relationship')}>
                    {Object.entries(relationships).map(([value, label]) => (
                      <option value={value} key={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field id="gender" label="性别">
                  <Select id="gender" {...register('gender')}>
                    <option value="">不填写</option>
                    <option value="MALE">男</option>
                    <option value="FEMALE">女</option>
                    <option value="OTHER">其他</option>
                  </Select>
                </Field>
                <Field
                  id="avatar"
                  label="头像链接"
                  hint="可选，使用公开的 https 图片链接"
                  error={errors.avatar?.message}
                >
                  <Input
                    id="avatar"
                    type="url"
                    placeholder="https://…"
                    {...register('avatar')}
                  />
                </Field>
              </div>
            </section>
            <section className="form-section">
              <div className="form-section-heading">
                <CalendarDays size={18} />
                <div>
                  <h2>生日信息</h2>
                  <p>按 {workspace.timeZone} 计算生日与倒计时</p>
                </div>
              </div>
              <div className="form-grid">
                <Field id="birthdayType" label="生日历法 *">
                  <Select id="birthdayType" {...register('birthdayType')}>
                    <option value="SOLAR">公历（阳历）</option>
                    <option value="LUNAR">农历（阴历）</option>
                  </Select>
                </Field>
                <Field
                  id="birthYear"
                  label={
                    values.birthdayType === 'LUNAR'
                      ? '农历出生年份'
                      : '出生年份'
                  }
                  hint={
                    values.birthdayType === 'LUNAR'
                      ? '填写农历年份；不填写就不显示年龄'
                      : '不填写就不显示年龄'
                  }
                  error={errors.birthYear?.message}
                >
                  <Input
                    id="birthYear"
                    inputMode="numeric"
                    placeholder="例如 1995，可留空"
                    {...register('birthYear')}
                  />
                </Field>
                <Field
                  id={fieldMonth}
                  label="月份 *"
                  error={errors[fieldMonth]?.message}
                >
                  <Select
                    key={fieldMonth}
                    id={fieldMonth}
                    {...register(fieldMonth)}
                  >
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i} value={i + 1}>
                        {i + 1} 月
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field
                  id={fieldDay}
                  label="日期 *"
                  error={errors[fieldDay]?.message}
                >
                  <Select key={fieldDay} id={fieldDay} {...register(fieldDay)}>
                    {Array.from(
                      { length: values.birthdayType === 'LUNAR' ? 30 : 31 },
                      (_, i) => (
                        <option key={i} value={i + 1}>
                          {i + 1} 日
                        </option>
                      ),
                    )}
                  </Select>
                </Field>
                {values.birthdayType === 'LUNAR' ? (
                  <>
                    <label className="checkbox-label full-width">
                      <input type="checkbox" {...register('isLeapMonth')} />
                      这是农历闰月生日
                    </label>
                    <Field
                      id="lunarLeapPolicy"
                      label="当年没有对应闰月时"
                      className="full-width"
                    >
                      <Select
                        id="lunarLeapPolicy"
                        {...register('lunarLeapPolicy')}
                      >
                        <option value="REGULAR">按同名普通月份庆祝</option>
                        <option value="SKIP">跳过该年，等待对应闰月</option>
                      </Select>
                    </Field>
                    <div className="notice full-width">
                      <Info size={16} />
                      <p>
                        农历支持 1900–2100
                        年，逐年换算为公历。周年遇到小月没有三十时，按该月最后一天庆祝；已知出生年份时，原始出生日期必须真实存在。
                      </p>
                    </div>
                  </>
                ) : (
                  <Field
                    id="leapDayPolicy"
                    label="2 月 29 日在平年如何庆祝"
                    className="full-width"
                  >
                    <Select id="leapDayPolicy" {...register('leapDayPolicy')}>
                      <option value="FEB28">2 月 28 日</option>
                      <option value="MAR1">3 月 1 日</option>
                    </Select>
                  </Field>
                )}
              </div>
            </section>
            <section className="form-section">
              <div className="form-section-heading">
                <Tags size={18} />
                <h2>联系与备注</h2>
              </div>
              <div className="form-grid">
                <Field
                  id="email"
                  label="联系人邮箱"
                  hint="仅作记录，生日提醒会发给你本人"
                  error={errors.email?.message}
                >
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@example.com"
                    {...register('email')}
                  />
                </Field>
                <Field id="phone" label="手机号" error={errors.phone?.message}>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="可选"
                    {...register('phone')}
                  />
                </Field>
                <div className="field full-width">
                  <label>自定义标签</label>
                  {workspace.tags.length ? (
                    <div className="chip-options">
                      {workspace.tags.map((tag) => (
                        <label
                          className={`chip-option ${values.tagIds?.includes(tag.id) ? 'selected' : ''}`}
                          key={tag.id}
                        >
                          <input
                            type="checkbox"
                            value={tag.id}
                            {...register('tagIds')}
                          />
                          <span
                            className="color-dot"
                            style={{ background: tag.color }}
                          />
                          {tag.name}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="field-hint">
                      还没有标签，保存后可前往{' '}
                      <Link href="/groups" className="text-link">
                        标签与分组
                      </Link>{' '}
                      创建。
                    </p>
                  )}
                </div>
                <Field
                  id="notes"
                  label="备注"
                  className="full-width"
                  error={errors.notes?.message}
                >
                  <Textarea
                    id="notes"
                    placeholder="喜欢的东西、想说的话，或是一个小小的约定…"
                    {...register('notes')}
                  />
                </Field>
              </div>
            </section>
          </fieldset>
          <div className="form-footer">
            <Button asChild variant="secondary">
              <Link href={contact ? `/contacts/${contact.id}` : '/contacts'}>
                取消
              </Link>
            </Button>
            <Button type="submit" loading={pending}>
              <Save size={16} />
              {contact ? '保存修改' : '保存联系人'}
            </Button>
          </div>
        </form>
      </Panel>
    </div>
  );
}

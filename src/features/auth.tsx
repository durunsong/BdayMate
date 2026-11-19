'use client';
import Link from 'next/link';
import { useProgressRouter as useRouter } from '@/lib/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ArrowLeft,
  ArrowRight,
  Cake,
  CheckCircle2,
  Eye,
  EyeOff,
  Heart,
  Mail,
  ExternalLink,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { Brand } from '@/components/app-shell';
import { Button, Field, FormMessage, Input } from '@/components/ui';
import { authClient } from '@/lib/auth-client';
import { ThemeToggle } from '@/components/theme-provider';
import './auth.css';
type AuthMode = 'login' | 'register' | 'forgot' | 'reset' | 'verify';
const labels = {
  login: {
    title: '欢迎回来',
    description: '登录生日搭子，看看最近有哪些值得期待的日子。',
    button: '登录',
  },
  register: {
    title: '从今天，记住每一份在乎',
    description: '创建你的生日搭子账户，让重要的日子有迹可循。',
    button: '创建账户',
  },
  forgot: {
    title: '找回你的账户',
    description: '输入注册邮箱，我们会发送密码重置链接。',
    button: '发送重置链接',
  },
  reset: {
    title: '设置一个新密码',
    description: '设置至少 10 位的新密码，重新回到你的生日空间。',
    button: '重置密码',
  },
  verify: {
    title: '确认是你的邮箱',
    description: '还差一次点击，就能开始记住重要的日子。',
    button: '重新发送验证邮件',
  },
};
export function authErrorMessage(error: {
  message?: string;
  code?: string;
  status?: number;
}): string {
  if (error.status === 429) return '操作太频繁，请稍等一分钟后重试。';
  const errors: Record<string, string> = {
    INVALID_EMAIL_OR_PASSWORD: '邮箱或密码不正确，请检查后重试。',
    EMAIL_NOT_VERIFIED: '请先验证邮箱，我们已重新发送验证邮件。',
    USER_ALREADY_EXISTS: '这个邮箱已注册，请直接登录。',
    USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: '这个邮箱已注册，请直接登录。',
    INVALID_PASSWORD: '当前密码不正确，请重新输入。',
    PASSWORD_TOO_SHORT: '密码至少需要 10 位。',
    PASSWORD_TOO_LONG: '密码不能超过 128 位。',
    INVALID_TOKEN: '链接已过期或失效，请重新申请。',
    TOKEN_EXPIRED: '链接已过期，请重新申请。',
    TOO_MANY_REQUESTS: '操作太频繁，请稍等一分钟后重试。',
    SESSION_EXPIRED: '登录已过期，请重新登录。',
    INVALID_OTP: '验证码不正确或已失效，请重试或重新发送。',
    OTP_EXPIRED: '验证码已过期，请重新发送。',
    TOO_MANY_ATTEMPTS: '验证码尝试次数已用完，请重新发送。',
    OTP_DELIVERY_FAILED: '验证码发送失败，请稍后重试。',
  };
  return error.code && errors[error.code]
    ? errors[error.code]
    : '暂时无法完成，请检查输入或稍后重试。';
}
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-page">
      <div className="auth-theme-control">
        <ThemeToggle />
      </div>
      <aside className="auth-story">
        <Brand href="/" />
        <div className="auth-story-body">
          <h1>
            有些日子，
            <br />
            因为<span>有人在乎</span>，<br />
            而变得特别。
          </h1>
          <p>
            把重要的人放在心上，把重要的日子交给我们。每一声准时的生日快乐，都是一份温柔的惦记。
          </p>
          <div className="auth-story-art" aria-hidden>
            <div className="auth-art-calendar">
              <div className="month">A SPECIAL DAY</div>
              <div className="cake">
                <Cake size={53} strokeWidth={1.2} />
              </div>
            </div>
            <div className="auth-art-note">
              <Heart size={20} strokeWidth={1.4} />
              <p>
                记住生日，
                <br />
                也记住彼此。
              </p>
            </div>
          </div>
        </div>
        <div className="auth-story-footer">Never Miss a Special Day.</div>
      </aside>
      <main className="auth-main">
        <div className="auth-mobile-brand">
          <Brand href="/" />
        </div>
        {children}
        <div className="auth-assurance">
          <ShieldCheck size={13} />
          你的记录只属于你，安心记下每一份在乎。
        </div>
      </main>
    </div>
  );
}
export function AuthForm({
  mode,
  email = '',
  token = '',
  verified = false,
  errorCode = '',
}: {
  mode: AuthMode;
  email?: string;
  token?: string;
  verified?: boolean;
  errorCode?: string;
}) {
  const [loginMethod, setLoginMethod] = useState<'password' | 'otp'>(
    'password',
  );
  const otpLogin = mode === 'login' && loginMethod === 'otp';
  const [sendingCode, setSendingCode] = useState(false);
  const [pending, setPending] = useState(false);
  const submitting = useRef(false);
  const [checking, setChecking] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [checkMessage, setCheckMessage] = useState('');
  const [cooldown, setCooldown] = useState(
    mode === 'verify' && email && !errorCode ? 60 : 0,
  );
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState(
    errorCode ? '验证链接已失效，请重新发送验证邮件。' : '',
  );
  const [sent, setSent] = useState(false);
  const router = useRouter();
  const cooldownActive = cooldown > 0;
  useEffect(() => {
    if (!cooldownActive) return;
    const expiresAt = Date.now() + 60_000;
    const timer = window.setInterval(
      () =>
        setCooldown(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000))),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [cooldownActive]);
  async function checkVerification() {
    if (checking) return;
    setChecking(true);
    setCheckMessage('');
    try {
      const result = await authClient.getSession();
      if (result.error) {
        setCheckMessage('暂时无法检查，请稍后重试。');
      } else if (
        result.data?.user.emailVerified &&
        (!email || result.data.user.email.toLowerCase() === email.toLowerCase())
      ) {
        setConfirmed(true);
      } else {
        setCheckMessage(
          '还没有确认到验证结果。请先点击邮件里的「验证邮箱」；如果在其他浏览器完成，请返回登录。',
        );
      }
    } catch {
      setCheckMessage('网络连接失败，请稍后再次检查。');
    } finally {
      setChecking(false);
    }
  }
  const schema = z
    .object({
      email: mode === 'reset' ? z.string() : z.email('请输入有效的邮箱地址'),
      name:
        mode === 'register'
          ? z.string().trim().min(1, '请输入昵称').max(80, '昵称最多 80 字')
          : z.string(),
      password:
        mode === 'register' || mode === 'reset'
          ? z.string().min(10, '密码至少 10 位').max(128, '密码不能超过 128 位')
          : mode === 'login' && !otpLogin
            ? z.string().min(1, '请输入密码')
            : z.string(),
      otp: otpLogin
        ? z
            .string()
            .trim()
            .regex(/^\d{6}$/, '请输入 6 位数字验证码')
        : z.string(),
      confirmPassword: z.string(),
      rememberMe: z.boolean(),
    })
    .superRefine((data, ctx) => {
      if (
        (mode === 'register' || mode === 'reset') &&
        data.password !== data.confirmPassword
      )
        ctx.addIssue({
          code: 'custom',
          path: ['confirmPassword'],
          message: '两次输入的密码不一致',
        });
    });
  type Values = z.infer<typeof schema>;
  const {
    register,
    handleSubmit,
    trigger,
    getValues,
    setValue,
    clearErrors,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      email,
      password: '',
      otp: '',
      confirmPassword: '',
      rememberMe: true,
    },
  });
  async function sendLoginCode() {
    if (submitting.current || cooldown > 0) return;
    submitting.current = true;
    setPending(true);
    setSendingCode(true);
    setMessage('');
    setSent(false);
    try {
      if (!(await trigger('email'))) return;
      const result = await authClient.emailOtp.sendVerificationOtp({
        email: getValues('email'),
        type: 'sign-in',
      });
      if (result.error) {
        setMessage(authErrorMessage(result.error));
        if (result.error.status === 429) setCooldown(60);
        return;
      }
      setValue('otp', '');
      clearErrors('otp');
      setSent(true);
      setCooldown(60);
    } catch {
      setMessage('网络连接失败，请稍后重试。');
    } finally {
      submitting.current = false;
      setPending(false);
      setSendingCode(false);
    }
  }
  async function submit(data: Values) {
    if (submitting.current || (mode === 'verify' && cooldown > 0)) return;
    submitting.current = true;
    setPending(true);
    setMessage('');
    try {
      if (mode === 'login') {
        const result = otpLogin
          ? await authClient.signIn.emailOtp({
              email: data.email,
              otp: data.otp,
            })
          : await authClient.signIn.email({
              email: data.email,
              password: data.password,
              rememberMe: data.rememberMe,
            });
        if (result.error) {
          setMessage(authErrorMessage(result.error));
          if (result.error.code === 'EMAIL_NOT_VERIFIED')
            router.push(
              `/verify-email?email=${encodeURIComponent(data.email)}`,
            );
          return;
        }
        router.push('/dashboard');
        router.refresh();
      } else if (mode === 'register') {
        const result = await authClient.signUp.email({
          name: data.name,
          email: data.email,
          password: data.password,
          callbackURL: '/verify-email',
        });
        if (result.error) {
          setMessage(authErrorMessage(result.error));
          return;
        }
        router.push(`/verify-email?email=${encodeURIComponent(data.email)}`);
      } else if (mode === 'forgot') {
        const result = await authClient.requestPasswordReset({
          email: data.email,
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (result.error) {
          setMessage(authErrorMessage(result.error));
          return;
        }
        setSent(true);
      } else if (mode === 'reset') {
        const result = await authClient.resetPassword({
          newPassword: data.password,
          token,
        });
        if (result.error) {
          setMessage(authErrorMessage(result.error));
          return;
        }
        toast.success('密码已更新，请使用新密码登录');
        router.push('/login');
      } else {
        const result = await authClient.sendVerificationEmail({
          email: data.email,
          callbackURL: '/verify-email',
        });
        if (result.error) {
          setMessage(authErrorMessage(result.error));
          if (result.error.code === 'TOO_MANY_REQUESTS') setCooldown(60);
          return;
        }
        setSent(true);
        setCooldown(60);
      }
    } catch {
      setMessage('网络连接失败，请稍后重试。');
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }
  const text = labels[mode];
  const inboxProviders: Record<string, { name: string; url: string }> = {
    'gmail.com': { name: 'Gmail', url: 'https://mail.google.com/' },
    'googlemail.com': { name: 'Gmail', url: 'https://mail.google.com/' },
    'outlook.com': { name: 'Outlook', url: 'https://outlook.live.com/mail/' },
    'hotmail.com': { name: 'Outlook', url: 'https://outlook.live.com/mail/' },
    'live.com': { name: 'Outlook', url: 'https://outlook.live.com/mail/' },
    'qq.com': { name: 'QQ 邮箱', url: 'https://mail.qq.com/' },
    'foxmail.com': { name: 'QQ 邮箱', url: 'https://mail.qq.com/' },
    '163.com': { name: '网易邮箱', url: 'https://mail.163.com/' },
    '126.com': { name: '网易邮箱', url: 'https://mail.126.com/' },
    'icloud.com': { name: 'iCloud 邮箱', url: 'https://www.icloud.com/mail/' },
  };
  const inbox = inboxProviders[email.trim().toLowerCase().split('@')[1]];
  if (mode === 'verify' && (verified || confirmed) && (!errorCode || confirmed))
    return (
      <div className="auth-form">
        <div className="auth-mail-symbol auth-mail-confirmed">
          <CheckCircle2 size={28} />
        </div>
        <h1>邮箱验证成功</h1>
        <p className="auth-subtitle">
          你的生日空间已经准备好，开始记住重要的人吧。
        </p>
        <Button asChild>
          <Link href="/dashboard">
            进入生日搭子
            <ArrowRight size={16} />
          </Link>
        </Button>
      </div>
    );
  return (
    <div className="auth-form">
      {mode === 'verify' && (
        <div className="auth-mail-symbol">
          <Mail size={28} />
        </div>
      )}
      <h1>{text.title}</h1>
      <p className="auth-subtitle">{text.description}</p>
      {mode === 'login' && (
        <div className="auth-login-methods" role="group" aria-label="登录方式">
          {(['password', 'otp'] as const).map((method) => (
            <Button
              key={method}
              type="button"
              variant={loginMethod === method ? 'secondary' : 'ghost'}
              aria-pressed={loginMethod === method}
              disabled={pending}
              onClick={() => {
                setLoginMethod(method);
                clearErrors();
                setValue('otp', '');
                setMessage('');
                setSent(false);
              }}
            >
              {method === 'password' ? '密码登录' : '邮箱验证码登录'}
            </Button>
          ))}
        </div>
      )}
      {mode === 'verify' && (
        <div className="auth-verification-guide">
          {email && (
            <p className="auth-destination">
              验证邮件会发往<strong>{email}</strong>
            </p>
          )}
          <ol className="auth-verification-steps">
            <li>
              <span>1</span>
              <div>
                <strong>去收件箱找一封来信</strong>
                <p>查找「验证你的 BdayMate 邮箱」，也看看垃圾邮件文件夹。</p>
              </div>
            </li>
            <li>
              <span>2</span>
              <div>
                <strong>点击邮件里的「验证邮箱」</strong>
                <p>链接会带你回到这里，确认后就能进入生日搭子。</p>
              </div>
            </li>
          </ol>
          {inbox ? (
            <Button asChild>
              <a href={inbox.url} target="_blank" rel="noopener noreferrer">
                前往 {inbox.name} 收件箱
                <ExternalLink size={16} />
              </a>
            </Button>
          ) : (
            <p className="auth-inbox-hint">
              打开你的邮箱应用，完成上面两个小步骤。
            </p>
          )}
          <Button
            type="button"
            variant="secondary"
            loading={checking}
            onClick={checkVerification}
          >
            <RefreshCw size={16} />
            我已点击验证，检查状态
          </Button>
          {checkMessage && (
            <p className="auth-check-message" role="status">
              {checkMessage}
            </p>
          )}
        </div>
      )}
      <FormMessage message={message} />
      {sent && (
        <div className="validation-success" role="status">
          {otpLogin
            ? '如果这个邮箱已注册，登录验证码会发送到你的收件箱，5 分钟内有效。请同时检查垃圾邮件。'
            : mode === 'forgot'
              ? '如果这个邮箱已注册，重置链接会发送到你的收件箱。请同时检查垃圾邮件文件夹。'
              : '如果邮箱尚未验证，新的验证链接会发送到你的收件箱。请检查收件箱和垃圾邮件。'}
        </div>
      )}
      {mode === 'reset' && !token ? (
        <>
          <FormMessage message="重置链接缺少有效凭证，请重新申请。" />
          <Button asChild>
            <Link href="/forgot-password">重新申请重置密码</Link>
          </Button>
        </>
      ) : (
        <form
          onSubmit={(event) => void handleSubmit(submit)(event)}
          className="auth-form-fields"
          noValidate
        >
          {mode === 'register' && (
            <Field id="auth-name" label="昵称" error={errors.name?.message}>
              <Input
                id="auth-name"
                autoComplete="nickname"
                placeholder="我们该怎么称呼你"
                {...register('name')}
                disabled={pending}
              />
            </Field>
          )}
          {mode !== 'reset' && (mode !== 'verify' || !email) && (
            <Field
              id="auth-email"
              label="邮箱地址"
              error={errors.email?.message}
            >
              <Input
                id="auth-email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                {...register('email', {
                  onChange: () => {
                    if (otpLogin) {
                      setValue('otp', '');
                      setSent(false);
                      setMessage('');
                    }
                  },
                })}
                disabled={pending}
              />
            </Field>
          )}
          {otpLogin && (
            <>
              <Field
                id="auth-otp"
                label="邮箱验证码"
                error={errors.otp?.message}
                hint="输入邮件中的 6 位数字验证码"
              >
                <Input
                  id="auth-otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="6 位数字验证码"
                  {...register('otp')}
                  disabled={pending}
                />
              </Field>
              <Button
                type="button"
                variant="secondary"
                loading={sendingCode}
                disabled={pending || cooldown > 0}
                onClick={() => void sendLoginCode()}
              >
                {cooldown > 0 ? `重新发送（${cooldown} 秒后）` : '发送验证码'}
              </Button>
            </>
          )}
          {['login', 'register', 'reset'].includes(mode) && !otpLogin && (
            <Field
              id="auth-password"
              label={mode === 'reset' ? '新密码' : '密码'}
              error={errors.password?.message}
              hint={
                mode !== 'login'
                  ? '至少 10 位，建议组合使用字母、数字和符号'
                  : undefined
              }
            >
              <div className="password-input">
                <Input
                  id="auth-password"
                  type={visible ? 'text' : 'password'}
                  autoComplete={
                    mode === 'login' ? 'current-password' : 'new-password'
                  }
                  placeholder={
                    mode === 'login' ? '输入你的密码' : '设置至少 10 位密码'
                  }
                  {...register('password')}
                  disabled={pending}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={visible ? '隐藏密码' : '显示密码'}
                  onClick={() => setVisible((v) => !v)}
                >
                  {visible ? <EyeOff size={17} /> : <Eye size={17} />}
                </Button>
              </div>
            </Field>
          )}
          {(mode === 'register' || mode === 'reset') && (
            <Field
              id="auth-confirm"
              label="确认密码"
              error={errors.confirmPassword?.message}
            >
              <Input
                id="auth-confirm"
                type="password"
                autoComplete="new-password"
                placeholder="再输入一次密码"
                {...register('confirmPassword')}
                disabled={pending}
              />
            </Field>
          )}
          {mode === 'login' && !otpLogin && (
            <div className="row-between">
              <label className="checkbox-label" style={{ fontSize: 12 }}>
                <input type="checkbox" {...register('rememberMe')} />
                记住我
              </label>
              <Link href="/forgot-password" className="text-link">
                忘记密码？
              </Link>
            </div>
          )}
          <Button
            type="submit"
            loading={pending && !sendingCode}
            variant={mode === 'verify' ? 'ghost' : 'primary'}
            disabled={sendingCode || (mode === 'verify' && cooldown > 0)}
          >
            {mode === 'verify' && cooldown > 0
              ? `重新发送（${cooldown} 秒后）`
              : text.button}
            {mode !== 'verify' && <ArrowRight size={16} />}
          </Button>
        </form>
      )}
      {mode === 'verify' && (
        <p className="auth-email-help">
          邮箱填错了？<Link href="/register">返回修改邮箱</Link>
        </p>
      )}
      {mode === 'login' ? (
        <p className="auth-alternative">
          还没有账户？<Link href="/register">创建一个</Link>
        </p>
      ) : mode === 'register' ? (
        <p className="auth-alternative">
          已经有账户了？<Link href="/login">登录</Link>
        </p>
      ) : (
        <div className="auth-back">
          <Link href="/login">
            <ArrowLeft
              size={13}
              style={{ display: 'inline', marginRight: 6 }}
            />
            返回登录
          </Link>
        </div>
      )}
    </div>
  );
}

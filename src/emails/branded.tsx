import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';
export type BrandedEmailProps = {
  heading: string;
  body: string;
  url?: string;
  buttonLabel?: string;
  details?: { label: string; value: string }[];
};
export function BrandedEmail({
  heading,
  body,
  url,
  buttonLabel = '打开 BdayMate',
  details = [],
}: BrandedEmailProps) {
  return (
    <Html lang="zh-CN">
      <Head />
      <Preview>{heading}</Preview>
      <Body
        style={{
          backgroundColor: '#f8fafc',
          fontFamily: 'Arial, sans-serif',
          color: '#1e293b',
          padding: '32px 12px',
        }}
      >
        <Container
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            padding: '32px',
            maxWidth: '560px',
          }}
        >
          <Text style={{ color: '#4f46e5', fontWeight: 700, fontSize: '20px' }}>
            BdayMate · 生日搭子
          </Text>
          <Heading style={{ fontSize: '26px', lineHeight: '1.4' }}>
            {heading}
          </Heading>
          <Text style={{ whiteSpace: 'pre-wrap', lineHeight: '1.8' }}>
            {body}
          </Text>
          <Section>
            {details.map(({ label, value }) => (
              <Text key={label} style={{ fontSize: '14px', lineHeight: '1.7' }}>
                <strong>{label}：</strong>
                {value}
              </Text>
            ))}
          </Section>
          {url && (
            <Button
              href={url}
              style={{
                backgroundColor: '#4f46e5',
                color: '#ffffff',
                borderRadius: '8px',
                padding: '13px 20px',
                marginTop: '16px',
              }}
            >
              {buttonLabel}
            </Button>
          )}
          <Hr style={{ borderColor: '#e2e8f0', marginTop: '32px' }} />
          <Text style={{ fontSize: '12px', color: '#64748b' }}>
            Never Miss a Special Day.
            <br />
            这封邮件来自你的 BdayMate 账户。可在设置中管理生日提醒。
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

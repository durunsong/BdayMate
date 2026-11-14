import { Fragment } from 'react';
import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from '@react-email/components';
export type BrandedEmailProps = {
  heading: string;
  body: string;
  url?: string;
  buttonLabel?: string;
  footer?: string;
  details?: { label: string; value: string }[];
};
export function BrandedEmail({
  heading,
  body,
  url,
  buttonLabel = '打开 BdayMate',
  details = [],
  footer = '这封邮件来自你的 BdayMate 账户。可在设置中管理生日提醒。',
}: BrandedEmailProps) {
  return (
    <Html lang="zh-CN">
      <Head />
      <Preview>{heading}</Preview>
      <Body
        style={{
          backgroundColor: '#f6f2ec',
          fontFamily: 'Arial, "PingFang SC", "Microsoft YaHei", sans-serif',
          color: '#373149',
          padding: '40px 12px',
        }}
      >
        <Container
          style={{
            maxWidth: '580px',
            backgroundColor: '#fffdf9',
            border: '1px solid #e6dfd7',
            borderRadius: '18px',
            overflow: 'hidden',
          }}
        >
          <Section
            style={{
              backgroundColor: '#eee7fa',
              borderBottom: '1px solid #ded3ee',
              padding: '25px 28px',
            }}
          >
            <Row>
              <Column style={{ width: '64px', verticalAlign: 'middle' }}>
                <Img
                  src={new URL(
                    '/brand/bdaymate-logo.png',
                    process.env.NEXT_PUBLIC_APP_URL ||
                      process.env.BETTER_AUTH_URL ||
                      'https://bdaymate.vercel.app',
                  ).toString()}
                  alt="BdayMate 生日搭子"
                  width="52"
                  height="52"
                  style={{ borderRadius: '13px', display: 'block' }}
                />
              </Column>
              <Column style={{ verticalAlign: 'middle' }}>
                <Text
                  style={{
                    color: '#563d89',
                    fontWeight: 700,
                    fontSize: '17px',
                    lineHeight: '1.5',
                    margin: '0',
                  }}
                >
                  BdayMate · 生日搭子
                </Text>
                <Text
                  style={{
                    color: '#6a587e',
                    fontSize: '12px',
                    lineHeight: '1.6',
                    margin: '3px 0 0',
                  }}
                >
                  把在乎，放进日历。
                </Text>
              </Column>
            </Row>
          </Section>
          <Section style={{ padding: '34px 28px 28px' }}>
            <Heading
              style={{
                fontSize: '27px',
                fontWeight: 600,
                lineHeight: '1.5',
                letterSpacing: '-0.5px',
                margin: '0 0 23px',
                color: '#342b44',
                overflowWrap: 'anywhere',
              }}
            >
              {heading}
            </Heading>
            <Text
              style={{
                fontSize: '15px',
                lineHeight: '1.95',
                margin: '0 0 24px',
                color: '#51485d',
                overflowWrap: 'anywhere',
              }}
            >
              {body.split(/\r?\n/).map((line, index) => (
                <Fragment key={index}>
                  {index > 0 && <br />}
                  {line}
                </Fragment>
              ))}
            </Text>
            {details.length > 0 && (
              <Section
                style={{
                  padding: '16px 18px',
                  backgroundColor: '#f6f0e7',
                  borderRadius: '10px',
                  marginBottom: '22px',
                }}
              >
                {details.map(({ label, value }) => (
                  <Row key={label}>
                    <Column
                      style={{
                        width: '62px',
                        verticalAlign: 'top',
                        padding: '5px 0',
                        fontSize: '13px',
                        lineHeight: '1.8',
                        color: '#76634e',
                      }}
                    >
                      {label}
                    </Column>
                    <Column
                      style={{
                        padding: '5px 0',
                        fontSize: '14px',
                        lineHeight: '1.8',
                        color: '#4b4035',
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {value}
                    </Column>
                  </Row>
                ))}
              </Section>
            )}
            {url && (
              <Section style={{ margin: '25px 0 0' }}>
                <Button
                  href={url}
                  style={{
                    backgroundColor: '#6841a5',
                    color: '#ffffff',
                    borderRadius: '10px',
                    padding: '15px 25px',
                    fontSize: '15px',
                    fontWeight: 600,
                    lineHeight: '1.5',
                    textAlign: 'center',
                  }}
                >
                  {buttonLabel}
                </Button>
                <Text
                  style={{
                    fontSize: '12px',
                    color: '#766b80',
                    lineHeight: '1.8',
                    margin: '18px 0 5px',
                  }}
                >
                  如果按钮无法打开，请复制下方链接到浏览器：
                </Text>
                <Link
                  href={url}
                  style={{
                    fontSize: '12px',
                    lineHeight: '1.8',
                    color: '#6841a5',
                    textDecoration: 'underline',
                    wordBreak: 'break-all',
                  }}
                >
                  {url}
                </Link>
              </Section>
            )}
            <Hr style={{ borderColor: '#e7dfd5', margin: '32px 0 22px' }} />
            <Text
              style={{
                fontFamily: 'Georgia, serif',
                fontStyle: 'italic',
                fontSize: '17px',
                lineHeight: '1.6',
                color: '#8c625b',
                margin: '0 0 12px',
              }}
            >
              Never Miss a Special Day.
            </Text>
            <Text
              style={{
                fontSize: '11px',
                lineHeight: '1.9',
                color: '#766b80',
                margin: '0',
              }}
            >
              {footer}
            </Text>
          </Section>
        </Container>
        <Text
          style={{
            textAlign: 'center',
            fontSize: '11px',
            lineHeight: '1.8',
            color: '#7b7066',
            margin: '20px 0 0',
          }}
        >
          一封来信，一份惦记。
        </Text>
      </Body>
    </Html>
  );
}

import ReactMarkdown from 'react-markdown'
import gfm from 'remark-gfm'

interface ExportMarkdownRendererProps {
  content: string
}

/**
 * 简化版 Markdown 渲染器，用于导出图片场景
 * - 无交互元素（无缩放、无点击事件）
 * - 简洁排版，适配 750px 宽度
 * - 链接显示为纯文字
 */
const ExportMarkdownRenderer = ({ content }: ExportMarkdownRendererProps) => {
  return (
    <div style={{
      fontSize: '15px',
      lineHeight: '1.8',
      color: '#333',
      wordBreak: 'break-word',
    }}>
      <ReactMarkdown
        remarkPlugins={[gfm]}
        components={{
          h1: ({ children, ...props }) => (
            <h1 style={{ fontSize: '22px', fontWeight: 700, marginTop: '24px', marginBottom: '12px', color: '#1a1a1a' }} {...props}>{children}</h1>
          ),
          h2: ({ children, ...props }) => (
            <h2 style={{ fontSize: '19px', fontWeight: 700, marginTop: '20px', marginBottom: '10px', color: '#1a1a1a', paddingBottom: '6px', borderBottom: '1px solid #eee' }} {...props}>{children}</h2>
          ),
          h3: ({ children, ...props }) => (
            <h3 style={{ fontSize: '17px', fontWeight: 600, marginTop: '16px', marginBottom: '8px', color: '#1a1a1a' }} {...props}>{children}</h3>
          ),
          h4: ({ children, ...props }) => (
            <h4 style={{ fontSize: '15px', fontWeight: 600, marginTop: '12px', marginBottom: '6px', color: '#333' }} {...props}>{children}</h4>
          ),
          p: ({ children, ...props }) => (
            <p style={{ marginTop: '10px', marginBottom: '10px' }} {...props}>{children}</p>
          ),
          a: ({ children, ...props }) => (
            <span style={{ color: '#4a90d9' }} {...props}>{children}</span>
          ),
          img: ({ ...props }) => (
            <div style={{ margin: '12px 0', textAlign: 'center' }}>
              <img {...props} style={{ maxWidth: '100%', borderRadius: '6px' }} alt={props.alt || ''} />
            </div>
          ),
          strong: ({ children, ...props }) => (
            <strong style={{ fontWeight: 700, color: '#1a1a1a' }} {...props}>{children}</strong>
          ),
          li: ({ children, ...props }) => {
            const rawText = String(children)
            const isFakeHeading = /^(\*\*.+\*\*)$/.test(rawText.trim())
            if (isFakeHeading) {
              return <div style={{ fontWeight: 700, fontSize: '16px', marginTop: '12px', marginBottom: '4px', color: '#1a1a1a' }}>{children}</div>
            }
            return <li style={{ marginTop: '4px', marginBottom: '4px' }} {...props}>{children}</li>
          },
          ul: ({ children, ...props }) => (
            <ul style={{ marginLeft: '20px', marginTop: '8px', marginBottom: '8px', listStyleType: 'disc' }} {...props}>{children}</ul>
          ),
          ol: ({ children, ...props }) => (
            <ol style={{ marginLeft: '20px', marginTop: '8px', marginBottom: '8px', listStyleType: 'decimal' }} {...props}>{children}</ol>
          ),
          blockquote: ({ children, ...props }) => (
            <blockquote style={{ borderLeft: '3px solid #ddd', paddingLeft: '12px', marginLeft: 0, color: '#666', fontStyle: 'italic', margin: '12px 0' }} {...props}>{children}</blockquote>
          ),
          code: ({ inline, className, children, ...props }) => {
            if (!inline) {
              return (
                <pre style={{ background: '#f6f8fa', padding: '12px', borderRadius: '6px', fontSize: '13px', overflow: 'hidden', margin: '10px 0' }}>
                  <code {...props}>{children}</code>
                </pre>
              )
            }
            return <code style={{ background: '#f0f0f0', padding: '2px 5px', borderRadius: '3px', fontSize: '13px' }} {...props}>{children}</code>
          },
          table: ({ children, ...props }) => (
            <div style={{ margin: '12px 0', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }} {...props}>{children}</table>
            </div>
          ),
          th: ({ children, ...props }) => (
            <th style={{ border: '1px solid #ddd', padding: '8px', fontWeight: 600, background: '#f9f9f9', textAlign: 'left' }} {...props}>{children}</th>
          ),
          td: ({ children, ...props }) => (
            <td style={{ border: '1px solid #ddd', padding: '8px' }} {...props}>{children}</td>
          ),
          hr: () => (
            <hr style={{ border: 'none', borderTop: '1px solid #e5e5e5', margin: '20px 0' }} />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

export default ExportMarkdownRenderer

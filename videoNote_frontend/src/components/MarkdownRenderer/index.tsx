import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { atomDark as codeStyle } from 'react-syntax-highlighter/dist/esm/styles/prism'
import Zoom from 'react-medium-image-zoom'
import 'react-medium-image-zoom/dist/styles.css'
import gfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import 'github-markdown-css/github-markdown-light.css'
import { Play, ExternalLink, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { FC } from 'react'

interface MarkdownRendererProps {
  content: string
  baseURL?: string
}

import { getBaseURL } from '@/utils/api'

// 确保 baseURL 没有尾部斜杠

const MarkdownRenderer: FC<MarkdownRendererProps> = ({ content, baseURL = getBaseURL() }) => {
  return (
    <div className="markdown-body w-full !bg-transparent">
      <ReactMarkdown
        remarkPlugins={[gfm, remarkMath]}
        rehypePlugins={[[rehypeKatex, { strict: false, trust: true }]]}
        components={{
          // Headings with improved styling and anchor links
          h1: ({ children, ...props }) => (
            <h1
              className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl"
              {...props}
            >
              {children}
            </h1>
          ),
          h2: ({ children, ...props }) => (
            <h2
              className="scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0"
              {...props}
            >
              {children}
            </h2>
          ),
          h3: ({ children, ...props }) => (
            <h3
              className="scroll-m-20 text-2xl font-semibold tracking-tight"
              {...props}
            >
              {children}
            </h3>
          ),
          h4: ({ children, ...props }) => (
            <h4
              className="scroll-m-20 text-xl font-semibold tracking-tight"
              {...props}
            >
              {children}
            </h4>
          ),

          // Paragraphs - use div to avoid invalid nesting when containing block elements (img/Zoom)
          p: ({ children, ...props }) => (
            <div className="leading-7 [&:not(:first-child)]:mt-6" {...props}>
              {children}
            </div>
          ),

          // Enhanced links with special handling for "原片" links
          a: ({ href, children, ...props }) => {
            const isOriginLink =
              typeof children[0] === 'string' &&
              (children[0] as string).startsWith('原片 @')

            if (isOriginLink) {
              const timeMatch = (children[0] as string).match(/原片 @ (\d{2}:\d{2})/)
              const timeText = timeMatch ? timeMatch[1] : '原片'

              return (
                <span className="origin-link my-2 inline-flex">
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30"
                    {...props}
                  >
                    <Play className="h-3.5 w-3.5" />
                    <span>原片（{timeText}）</span>
                  </a>
                </span>
              )
            }

            // Default link styling with external indicator
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:text-primary/80 inline-flex items-center gap-0.5 font-medium underline underline-offset-4"
                {...props}
              >
                {children}
                {href?.startsWith('http') && (
                  <ExternalLink className="ml-0.5 inline-block h-3 w-3" />
                )}
              </a>
            )
          },

          // Enhanced image with zoom capability
          img: ({ node, ...props }) => {
            // Fix the URL by removing the 'undefined' prefix if it exists
            let src = props.src
            if (src?.startsWith('/')) {
              src = baseURL + src
            }

            return (
              <div className="my-8 flex justify-center">
                <Zoom>
                  <img
                    {...props}
                    src={src}
                    className="max-w-full cursor-zoom-in rounded-lg object-cover shadow-md transition-all hover:shadow-lg"
                    style={{ maxHeight: '500px' }}
                    onError={(e) => {
                      const target = e.currentTarget
                      target.style.display = 'none'
                      const parent = target.closest('.my-8')
                      if (parent) parent.style.display = 'none'
                    }}
                  />
                </Zoom>
              </div>
            )
          },

          // Better strong/bold text
          strong: ({ children, ...props }) => (
            <strong className="font-bold" {...props}>
              {children}
            </strong>
          ),

          // Enhanced list items with support for "fake headings"
          li: ({ children, ...props }) => {
            const rawText = String(children)
            const isFakeHeading = /^(\*\*.+\*\*)$/.test(rawText.trim())

            if (isFakeHeading) {
              return (
                <div className="my-4 text-lg font-bold">{children}</div>
              )
            }

            // Remove ordered prop to avoid React warning
            const { ordered, ...safeProps } = props as any
            return (
              <li className="my-1" {...safeProps}>
                {children}
              </li>
            )
          },

          // Enhanced unordered lists
          ul: ({ children, ...props }) => {
            const { ordered, ...safeProps } = props as any
            return (
              <ul className="my-6 ml-6 list-disc [&>li]:mt-2" {...safeProps}>
                {children}
              </ul>
            )
          },

          // Enhanced ordered lists
          ol: ({ children, ...props }) => {
            const { ordered, ...safeProps } = props as any
            return (
              <ol className="my-6 ml-6 list-decimal [&>li]:mt-2" {...safeProps}>
                {children}
              </ol>
            )
          },

          // Enhanced blockquotes
          blockquote: ({ children, ...props }) => (
            <blockquote
              className="mt-6 border-l-2 pl-6 italic"
              {...props}
            >
              {children}
            </blockquote>
          ),

          // Enhanced code blocks with syntax highlighting and copy button
          code: ({ inline, className, children, ...props }) => {
            const match = /language-(\w+)/.exec(className || '')
            const codeContent = String(children).replace(/\n$/, '')

            if (!inline && match) {
              return (
                <div className="group bg-muted relative my-6 overflow-hidden rounded-lg border shadow-sm">
                  <div className="bg-muted text-muted-foreground flex items-center justify-between px-4 py-1.5 text-sm font-medium">
                    <div>{match[1].toUpperCase()}</div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(codeContent)
                        toast.success('代码已复制')
                      }}
                      className="bg-background/80 hover:bg-background flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      复制
                    </button>
                  </div>
                  <SyntaxHighlighter
                    style={codeStyle}
                    language={match[1]}
                    PreTag="div"
                    className="!bg-muted !m-0 !p-0"
                    customStyle={{
                      margin: 0,
                      padding: '1rem',
                      background: 'transparent',
                      fontSize: '0.9rem',
                    }}
                    {...props}
                  >
                    {codeContent}
                  </SyntaxHighlighter>
                </div>
              )
            }

            // Inline code styling
            return (
              <code
                className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold"
                {...props}
              >
                {children}
              </code>
            )
          },

          // Enhanced tables
          table: ({ children, ...props }) => (
            <div className="my-6 w-full overflow-y-auto">
              <table className="w-full border-collapse text-sm" {...props}>
                {children}
              </table>
            </div>
          ),

          // Table headers
          th: ({ children, isHeader, ...props }) => (
            <th
              className="border-muted-foreground/20 border px-4 py-2 text-left font-medium [&[align=center]]:text-center [&[align=right]]:text-right"
              {...props}
            >
              {children}
            </th>
          ),

          // Table cells
          td: ({ children, isHeader, ...props }) => (
            <td
              className="border-muted-foreground/20 border px-4 py-2 text-left [&[align=center]]:text-center [&[align=right]]:text-right"
              {...props}
            >
              {children}
            </td>
          ),

          // Horizontal rule
          hr: ({ ...props }) => (
            <hr className="border-muted-foreground/20 my-8" {...props} />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

export default MarkdownRenderer
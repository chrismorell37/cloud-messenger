import { NodeViewWrapper } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  
  const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  
  if (targetDate.getTime() === today.getTime()) {
    return 'Today'
  }
  if (targetDate.getTime() === yesterday.getTime()) {
    return 'Yesterday'
  }
  
  const currentYear = now.getFullYear()
  const targetYear = date.getFullYear()
  
  if (currentYear === targetYear) {
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
  }
  
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export function DateDividerNode({ node, updateAttributes }: NodeViewProps) {
  const { date, collapsed } = node.attrs
  
  const handleToggle = () => {
    updateAttributes({ collapsed: !collapsed })
  }
  
  const formattedDate = date ? formatDate(date) : 'Unknown Date'
  
  return (
    <NodeViewWrapper 
      className={`date-divider ${collapsed ? 'collapsed' : ''}`}
      data-collapsed={collapsed ? 'true' : 'false'}
      contentEditable={false}
    >
      <button
        onClick={handleToggle}
        className="date-divider-button"
        type="button"
      >
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          width="16" 
          height="16" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
          className={`date-divider-chevron ${collapsed ? '' : 'expanded'}`}
        >
          <path d="m9 18 6-6-6-6"/>
        </svg>
        <span className="date-divider-text">{formattedDate}</span>
      </button>
      <div className="date-divider-line" />
    </NodeViewWrapper>
  )
}

import { Node, mergeAttributes, ReactNodeViewRenderer } from '@tiptap/react'
import { DateDividerNode } from '../components/DateDividerNode'

export const DateDivider = Node.create({
  name: 'dateDivider',
  group: 'block',
  atom: true,
  selectable: false,
  draggable: false,

  addAttributes() {
    return {
      date: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-date'),
        renderHTML: (attributes: { date?: string | null }) => {
          if (!attributes.date) return {}
          return { 'data-date': attributes.date }
        },
      },
      collapsed: {
        default: false,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-collapsed') === 'true',
        renderHTML: (attributes: { collapsed?: boolean }) => {
          return { 'data-collapsed': attributes.collapsed ? 'true' : 'false' }
        },
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-date-divider]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-date-divider': 'true',
        class: 'date-divider',
      }),
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(DateDividerNode)
  },

  addCommands() {
    return {
      insertDateDivider:
        (options: { date: string; collapsed?: boolean }) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { date: options.date, collapsed: options.collapsed ?? false },
          })
        },
      toggleDateDivider:
        (date: string) =>
        ({ tr, state }) => {
          let found = false
          state.doc.descendants((node, pos) => {
            if (node.type.name === 'dateDivider' && node.attrs.date === date) {
              tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                collapsed: !node.attrs.collapsed,
              })
              found = true
              return false
            }
          })
          return found
        },
    }
  },
})

declare module '@tiptap/react' {
  interface Commands<ReturnType> {
    dateDivider: {
      insertDateDivider: (options: { date: string; collapsed?: boolean }) => ReturnType
      toggleDateDivider: (date: string) => ReturnType
    }
  }
}

'use client'

import { useEffect, useRef, useState } from 'react'

export function GrowableTextarea({
    value = '',
    placeholder,
    required = false,
    autoFocus = false,
    disabled = false,
    onChange,
    onEnter,
}: {
    value?: string
    placeholder?: string
    required?: boolean
    autoFocus?: boolean
    disabled?: boolean
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
    onEnter: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
}) {
    const mirrorRef = useRef<HTMLDivElement>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const [height, setHeight] = useState('2.13rem')

    useEffect(() => {
        if (typeof window === 'undefined') return
        if (mirrorRef.current && textareaRef.current) {
            const mirrorHeight = mirrorRef.current.offsetHeight
            setHeight(mirrorHeight + 'px')
        }
    }, [value])

    useEffect(() => {
        if (typeof window === 'undefined') return
        if (textareaRef.current && autoFocus) {
            const length = textareaRef.current.value.length
            textareaRef.current.setSelectionRange(length, length)
            textareaRef.current.focus()
        }
    }, [autoFocus])

    return (
        <div className="relative w-full">
            <div
                ref={mirrorRef}
                className="invisible m-0 max-h-60 w-full overflow-hidden whitespace-pre-wrap break-words break-all rounded-md border bg-red-200 px-3 py-1 pr-12 text-transparent"
            >
                {value ? value : 'test'}
            </div>
            <textarea
                ref={textareaRef}
                className="absolute left-0 top-0 m-0 flex w-full min-w-0 flex-1 resize-none overflow-auto break-words break-all rounded-md border border-gray-300 bg-gray-50 px-3 py-1 pr-12 text-base text-slate-500 ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus:border-blue-500 focus:ring-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                style={{ height }}
                value={value}
                placeholder={placeholder}
                required={required}
                autoFocus={autoFocus}
                disabled={disabled}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        if (onEnter) onEnter(e)
                    }
                }}
                onChange={onChange}
            ></textarea>
        </div>
    )
}

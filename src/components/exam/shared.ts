import { useEffect, useState } from 'react'
import type { QuestionType } from '../../exam/types'

export const QUESTION_TYPE_NAMES: Record<QuestionType, string> = {
  written: 'Written',
  mcq: 'Multiple choice',
  bench: 'Laboratory bench',
}

/** The current time, refreshed while the component is mounted. */
export function useNow(intervalMs = 500): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(timer)
  }, [intervalMs])
  return now
}

/** A duration as a clock reading: 12:05, or 1:02:05 from an hour up. */
export function formatClock(milliseconds: number): string {
  const total = Math.max(0, Math.ceil(milliseconds / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const pad = (value: number) => String(value).padStart(2, '0')
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`
}

export function formatDateTime(time: number | null): string {
  return time === null ? '—' : new Date(time).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export function formatTime(time: number | null): string {
  return time === null ? '—' : new Date(time).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

export const plural = (count: number, noun: string): string => `${count} ${noun}${count === 1 ? '' : 's'}`

import { useState, useEffect } from 'react'
import { getUpcomingHolidays, formatDate, isImportant } from '../lib/holidays'

export default function HolidayBanner() {
  const [hd, setHd] = useState({ current: null, next: null })
  useEffect(() => { setHd(getUpcomingHolidays()) }, [])
  if (!hd.current) return null
  return (
    <div className="holiday-banner">
      <span className="holiday-icon">🌍</span>
      <span className="holiday-label">营销日历</span>
      <div className="holiday-tags">
        {hd.current.events.map((e, i) => (
          <span key={i} className={`holiday-tag ${isImportant(e) ? 'imp' : ''}`} title={e.note}>
            <span className="holiday-date">{formatDate(e.date)}</span>
            {isImportant(e) && '🔥'}{e.name}
            <span className="holiday-region">{e.region}</span>
          </span>
        ))}
        {hd.next?.events.slice(0, 3).map((e, i) => (
          <span key={i} className={`holiday-tag ${isImportant(e) ? 'imp' : ''}`} title={e.note}>
            {formatDate(e.date)} {e.name}
          </span>
        ))}
      </div>
    </div>
  )
}
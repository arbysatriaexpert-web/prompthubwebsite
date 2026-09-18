import { createContext, useContext, useState, useCallback, useRef } from 'react'
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react'
import './Toast.css'

const ToastContext = createContext({ toast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

let idCounter = 0

export function ToastProvider({ children }) {
  const [items, setItems] = useState([])
  const timers = useRef({})

  const remove = useCallback((id) => {
    setItems(prev => prev.filter(t => t.id !== id))
    if (timers.current[id]) {
      clearTimeout(timers.current[id])
      delete timers.current[id]
    }
  }, [])

  // toast('Pesan', 'success' | 'error' | 'info', durasiMs)
  const toast = useCallback((message, type = 'success', duration = 3500) => {
    const id = ++idCounter
    setItems(prev => [...prev, { id, message, type }])
    timers.current[id] = setTimeout(() => remove(id), duration)
    return id
  }, [remove])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="toast-viewport" role="status" aria-live="polite">
        {items.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <span className="toast-icon">
              {t.type === 'success' && <CheckCircle2 size={18} />}
              {t.type === 'error' && <AlertTriangle size={18} />}
              {t.type === 'info' && <Info size={18} />}
            </span>
            <span className="toast-msg">{t.message}</span>
            <button className="toast-close" onClick={() => remove(t.id)} aria-label="Tutup">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

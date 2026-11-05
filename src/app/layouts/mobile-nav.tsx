import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function AppMobileNav() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="relative sm:hidden">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-controls="menu-publico"
      >
        {isOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        <span className="sr-only">{isOpen ? 'Fechar menu' : 'Abrir menu'}</span>
      </Button>

      {isOpen && (
        <div
          id="menu-publico"
          className="border-border bg-popover text-popover-foreground absolute top-11 right-0 w-56 rounded-md border p-2 shadow-lg"
        >
          <Link
            to="/instrucoes"
            className="focus-visible:ring-ring block rounded-sm px-3 py-2 text-sm font-medium focus-visible:ring-2 focus-visible:outline-none"
            onClick={() => setIsOpen(false)}
          >
            Instruções
          </Link>
        </div>
      )}
    </div>
  )
}

import { Hammer } from 'lucide-react'
import { Card, EmptyState, PageHeader } from '../components/ui'

export default function ComingSoon({ title, phase, text }: { title: string; phase: number; text: string }) {
  return (
    <div>
      <PageHeader title={title} />
      <Card>
        <EmptyState icon={<Hammer size={28} />} title={`Coming in Phase ${phase}`} text={text} />
      </Card>
    </div>
  )
}

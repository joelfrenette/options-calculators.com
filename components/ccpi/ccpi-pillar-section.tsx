import type React from "react"
import { memo } from "react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

interface PillarSectionProps {
  pillarNumber: number
  title: string
  score: number
  weight: number
  children: React.ReactNode
  defaultOpen?: boolean
}

export const CCPIPillarSection = memo(function CCPIPillarSection({
  pillarNumber,
  title,
  score,
  weight,
  children,
  defaultOpen = false,
}: PillarSectionProps) {
  return (
    <Accordion type="single" collapsible defaultValue={defaultOpen ? `pillar-${pillarNumber}` : undefined}>
      <AccordionItem value={`pillar-${pillarNumber}`}>
        <AccordionTrigger className="hover:no-underline">
          <div className="flex items-center justify-between w-full pr-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">
                {pillarNumber}
              </div>
              <div className="text-left">
                <h3 className="font-semibold text-base">{title}</h3>
                <p className="text-xs text-muted-foreground">Weight: {(weight * 100).toFixed(0)}%</p>
              </div>
            </div>
            <div className="text-right">
              <div className="font-bold text-lg">{score.toFixed(1)}</div>
              <div className="text-xs text-muted-foreground">Pillar Score</div>
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="space-y-6 pt-4">{children}</div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
})

import { Stagger, StaggerItem } from "@/components/motion/Reveal";

export const processSteps = [
  {
    title: "Seed selection",
    text: "We pick whole, mature seeds, then clean and sun-dry them. TODO(client): where seeds come from.",
  },
  {
    title: "Wooden ghani",
    text: "Seeds are crushed slowly in a wooden kolhu. The slow pace keeps the oil cool, so nothing is cooked out.",
  },
  {
    title: "Natural settling",
    text: "Fresh oil is left to rest so the solids settle on their own. Then it is filtered through cloth. TODO(client): settling time.",
  },
  {
    title: "Bottling",
    text: "Filled in small batches and sealed. TODO(client): batch numbering / traceability details.",
  },
];

export function ProcessSteps() {
  return (
    <Stagger as="ol" className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {processSteps.map((s, i) => (
        <StaggerItem as="li" key={s.title} className="rounded-[var(--radius-card)] bg-white p-6">
          <span className="grid size-11 place-items-center rounded-full bg-forest font-display text-xl text-white">
            {i + 1}
          </span>
          <h3 className="mt-4 text-2xl">{s.title}</h3>
          <p className="mt-2 text-ink-muted">{s.text}</p>
        </StaggerItem>
      ))}
    </Stagger>
  );
}

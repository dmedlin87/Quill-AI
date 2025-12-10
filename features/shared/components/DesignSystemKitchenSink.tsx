import React from 'react';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Input, Textarea } from './ui/Input';
import { Heading, Text } from './ui/Typography';
import { AgentIcon, WandIcon, ZenIcon } from './Icons';

export const DesignSystemKitchenSink: React.FC = () => {
  return (
    <div className="space-y-8 p-4 border rounded-xl border-[var(--border-secondary)] bg-[var(--surface-secondary)]/30">
      <Heading variant="h4" className="border-b border-[var(--border-secondary)] pb-2 mb-4">
        Design System Primitives
      </Heading>

      {/* Typography Section */}
      <section className="space-y-4">
        <Text variant="label">Typography</Text>
        <div className="space-y-2">
          <Heading variant="h1">Heading 1</Heading>
          <Heading variant="h2">Heading 2</Heading>
          <Heading variant="h3">Heading 3</Heading>
          <Text variant="body">Body text should be legible and comfortable to read. The quick brown fox jumps over the lazy dog.</Text>
          <Text variant="muted">Muted text for secondary information.</Text>
          <Text variant="code">Code snippet style</Text>
        </div>
      </section>

      {/* Buttons Section */}
      <section className="space-y-4">
        <Text variant="label">Buttons</Text>
        <div className="flex flex-wrap gap-3 items-center">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <Button size="sm" variant="primary">Small</Button>
          <Button size="md" variant="primary">Medium</Button>
          <Button size="lg" variant="primary">Large</Button>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <Button variant="primary" leftIcon={<WandIcon className="w-4 h-4" />}>Icon Left</Button>
          <Button variant="secondary" rightIcon={<AgentIcon className="w-4 h-4" />}>Icon Right</Button>
          <Button variant="secondary" isLoading>Loading</Button>
        </div>
      </section>

      {/* Inputs Section */}
      <section className="space-y-4">
        <Text variant="label">Inputs</Text>
        <div className="space-y-3 max-w-sm">
          <Input label="Standard Input" placeholder="Type something..." />
          <Input label="With Icon" leftIcon={<ZenIcon className="w-4 h-4" />} placeholder="Search..." />
          <Input label="Error State" error="This field is required" defaultValue="Invalid value" />
          <Textarea label="Textarea" placeholder="Longer content goes here..." />
        </div>
      </section>

      {/* Cards Section */}
      <section className="space-y-4">
        <Text variant="label">Cards</Text>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card variant="flat" padding="md">
            <Heading variant="h5">Flat Card</Heading>
            <Text variant="small">Simple border, no shadow.</Text>
          </Card>
          <Card variant="elevated" padding="md">
            <Heading variant="h5">Elevated Card</Heading>
            <Text variant="small">Shadow and subtle background.</Text>
          </Card>
          <Card variant="subtle" padding="md">
            <Heading variant="h5">Subtle Card</Heading>
            <Text variant="small">Filled background, no border.</Text>
          </Card>
           <Card variant="glass" padding="md">
            <Heading variant="h5">Glass Card</Heading>
            <Text variant="small">Blur effect (requires backdrop).</Text>
          </Card>
        </div>
      </section>
    </div>
  );
};

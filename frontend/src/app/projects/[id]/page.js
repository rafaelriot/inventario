import ProjectConsumptionClient from './ProjectConsumptionClient';

export function generateStaticParams() {
  return [{ id: '1' }];
}

export default function ProjectConsumptionPage() {
  return <ProjectConsumptionClient />;
}

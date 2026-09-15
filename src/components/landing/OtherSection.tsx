
"use client";

import { BrainCircuit, Lightbulb, Zap, ShieldCheck, Scaling, Users2, BarChartHorizontal, Code2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const otherFeatures = [
  {
    icon: BrainCircuit,
    title: "Intelligent Insights",
    description: "Leverage data-driven analytics to make informed decisions and optimize your inventory for maximum profitability.",
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
  },
  {
    icon: Scaling,
    title: "Scalable Architecture",
    description: "Built for growth, our system handles increasing complexity as your business expands to new products and locations.",
    color: "text-indigo-600 dark:text-indigo-400",
    bgColor: "bg-indigo-100 dark:bg-indigo-900/30",
  },
  {
    icon: Users2,
    title: "Collaborative Platform",
    description: "Efficiently manage staff access and operations across multiple stores with granular controls and role-based permissions.",
    color: "text-sky-600 dark:text-sky-400",
    bgColor: "bg-sky-100 dark:bg-sky-900/30",
  },
  {
    icon: ShieldCheck,
    title: "Secure & Reliable",
    description: "Your data is protected with industry-standard security measures, ensuring reliability and peace of mind.",
     color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-100 dark:bg-green-900/30",
  },
  {
    icon: Lightbulb,
    title: "Continuous Innovation",
    description: "We're constantly evolving with cutting-edge features to meet the dynamic demands of modern commerce.",
    color: "text-yellow-600 dark:text-yellow-400",
    bgColor: "bg-yellow-100 dark:bg-yellow-900/30",
  },
  {
    icon: Code2,
    title: "Developer Friendly",
    description: "Built with Next.js, React, and Tailwind CSS for a modern, maintainable, and extensible codebase.",
    color: "text-rose-600 dark:text-rose-400",
    bgColor: "bg-rose-100 dark:bg-rose-900/30",
  },
];


export function OtherSection() {
  return (
    <section id="other" className="section-padding bg-background dark:bg-secondary/10">
      <div className="section-container">
        <div className="text-center mb-16 md:mb-20">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-foreground">
            More Than Just <span className="text-gradient-primary">Inventory</span>
          </h2>
          <p className="mt-6 max-w-2xl mx-auto text-lg text-muted-foreground">
            Our platform is engineered to adapt and grow with your business, offering unique advantages and robust solutions.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-10">
          {otherFeatures.map((feature) => (
            <InfoCard
              key={feature.title}
              icon={feature.icon}
              title={feature.title}
              description={feature.description}
              color={feature.color}
              bgColor={feature.bgColor}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

interface InfoCardProps {
  icon: React.ElementType;
  title: string;
  description: string;
  color: string;
  bgColor: string;
}

const InfoCard: React.FC<InfoCardProps> = ({ icon: Icon, title, description, color, bgColor }) => {
  return (
    <div 
      className="p-8 bg-card rounded-xl shadow-xl hover:shadow-2xl dark:shadow-primary/10 dark:hover:shadow-primary/20 transition-all duration-300 ease-in-out border border-border/70 hover:border-primary/50 flex flex-col items-center text-center group"
    >
      <div className={cn(
        "p-5 rounded-full mb-6 inline-flex transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg",
        bgColor,
        color
        )}>
        <Icon className="h-10 w-10" />
      </div>
      <h3 className={cn("text-xl md:text-2xl font-semibold text-foreground mb-4 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r", color === "text-primary" ? "from-primary to-green-400 dark:to-green-500" : `from-current to-${color.split('-')[0]}-400/80 dark:to-${color.split('-')[0]}-300/80`)}>{title}</h3>
      <p className="text-muted-foreground text-base leading-relaxed flex-grow">{description}</p>
    </div>
  );
};

    
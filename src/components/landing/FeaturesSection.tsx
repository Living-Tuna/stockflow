
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChartBig, PackageSearch, Users, ShoppingCart, Zap, ShieldCheck, Settings, Code } from 'lucide-react';
import { APP_NAME } from '@/lib/constants';
import { cn } from '@/lib/utils';

const features = [
  {
    icon: ShoppingCart,
    title: "Seamless Billing",
    description: "Create sales, purchase, and return bills effortlessly with our intuitive interface, variant support, and payment tracking.",
    color: "text-primary",
    bgColor: "bg-primary/10 dark:bg-primary/15",
    borderColor: "border-primary/30 dark:border-primary/40"
  },
  {
    icon: PackageSearch,
    title: "Advanced Inventory",
    description: "Track products, manage stock levels per SKU, and handle complex product variants with ease.",
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-600/10 dark:bg-green-500/15",
    borderColor: "border-green-600/30 dark:border-green-500/40"
  },
  {
    icon: Users,
    title: "Multi-Store & Staff",
    description: "Manage multiple store locations and staff members with role-based access and dedicated terminal views.",
     color: "text-blue-600 dark:text-blue-400",
     bgColor: "bg-blue-600/10 dark:bg-blue-500/15",
     borderColor: "border-blue-600/30 dark:border-blue-500/40"
  },
  {
    icon: BarChartBig,
    title: "Insightful Dashboard",
    description: "Get a clear overview of your business health with dynamic charts, purchase tracking, and key performance indicators.",
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-600/10 dark:bg-purple-500/15",
    borderColor: "border-purple-600/30 dark:border-purple-500/40"
  },
   {
    icon: Zap,
    title: "Fast & Responsive",
    description: "Experience a lightning-fast UI designed for maximum productivity and minimal friction across all devices.",
    color: "text-orange-600 dark:text-orange-400",
    bgColor: "bg-orange-600/10 dark:bg-orange-500/15",
    borderColor: "border-orange-600/30 dark:border-orange-500/40"
  },
  {
    icon: Settings,
    title: "Customizable Settings",
    description: "Tailor the application to your needs with configurable billing defaults, currency options, and theme preferences.",
    color: "text-teal-600 dark:text-teal-400",
    bgColor: "bg-teal-600/10 dark:bg-teal-500/15",
    borderColor: "border-teal-600/30 dark:border-teal-500/40"
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="section-padding bg-tertiary dark:bg-background">
      <div className="section-container">
        <div className="text-center mb-16 md:mb-20">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-foreground">
            Why <span className="text-gradient-primary">{APP_NAME}</span> is Your Best Choice
          </h2>
          <p className="mt-6 max-w-2xl mx-auto text-lg text-muted-foreground">
            Empowering your business with features designed for growth, efficiency, and modern demands.
          </p>
        </div>
        <div className="grid gap-8 md:gap-10 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <Card 
              key={feature.title} 
              className={cn(
                "bg-card shadow-xl hover:shadow-2xl dark:shadow-primary/10 dark:hover:shadow-primary/20 transition-all duration-300 ease-in-out",
                "border-t-4 rounded-xl group",
                feature.borderColor,
                `hover:${feature.borderColor.replace("/30", "/60").replace("/40", "/70")}` 
              )}
            >
              <CardHeader className="items-center text-center pt-10 pb-5">
                <div className={cn(
                  "mb-6 p-5 rounded-full inline-block group-hover:scale-110 transition-transform duration-300 shadow-inner",
                  feature.bgColor, 
                  feature.color
                )}>
                  <feature.icon className="h-12 w-12" />
                </div>
                <CardTitle className={cn("text-xl md:text-2xl text-foreground font-semibold group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r", feature.color === "text-primary" ? "from-primary to-green-400 dark:to-green-500" : "from-current to-current/70")}>{feature.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-center pb-10 px-8">
                <p className="text-muted-foreground text-base leading-relaxed">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

    
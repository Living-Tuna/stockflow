"use client";

import { Monitor, Smartphone, Command, Server, ArrowRight, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { BRIDGE_DOWNLOADS, SCANNER_BRIDGE_VERSION } from '@/lib/scanner-bridge-downloads';

interface PlatformDef {
    name: string;
    key: string;
    icon: typeof Monitor;
    description: string;
    version: string;
    color: string;
    bgColor: string;
    hoverBorder: string;
    btnClass: string;
    downloadUrl?: string;
    fileName?: string;
    comingSoon?: boolean;
    note: string;
}

const platforms: PlatformDef[] = [
    {
        name: "Windows",
        key: "windows",
        icon: Monitor,
        description: "Maximum performance for your desktop workstation.",
        version: `Latest v${SCANNER_BRIDGE_VERSION}`,
        color: "text-blue-500",
        bgColor: "bg-blue-500/10",
        hoverBorder: "group-hover:border-blue-500/30",
        btnClass: "bg-blue-600 hover:bg-blue-700 text-white",
        downloadUrl: BRIDGE_DOWNLOADS.find(d => d.platform === 'windows')?.url,
        fileName: BRIDGE_DOWNLOADS.find(d => d.platform === 'windows')?.fileName,
        note: "Scanner Bridge (barcode auto-billing)",
    },
    {
        name: "macOS",
        key: "mac",
        icon: Command,
        description: "Designed for the Apple ecosystem.",
        version: "Latest v1.1.1",
        color: "text-stone-500 dark:text-stone-300",
        bgColor: "bg-stone-500/10 dark:bg-stone-500/20",
        hoverBorder: "group-hover:border-stone-500/30",
        btnClass: "bg-stone-800 hover:bg-stone-900 text-white dark:bg-stone-700 dark:hover:bg-stone-600",
        comingSoon: true,
        note: "macOS edition coming soon",
    },
    {
        name: "Linux",
        key: "linux",
        icon: Server,
        description: "Secure, reliable, and open for your infrastructure.",
        version: `Latest v${SCANNER_BRIDGE_VERSION}`,
        color: "text-orange-500",
        bgColor: "bg-orange-500/10",
        hoverBorder: "group-hover:border-orange-500/30",
        btnClass: "bg-orange-600 hover:bg-orange-700 text-white",
        downloadUrl: BRIDGE_DOWNLOADS.find(d => d.platform === 'linux')?.url,
        fileName: BRIDGE_DOWNLOADS.find(d => d.platform === 'linux')?.fileName,
        note: "Scanner Bridge (barcode auto-billing)",
    },
    {
        name: "Android",
        key: "android",
        icon: Smartphone,
        description: "Manage your inventory on the go.",
        version: "Latest v1.1.1",
        color: "text-green-500",
        bgColor: "bg-green-500/10",
        hoverBorder: "group-hover:border-green-500/30",
        btnClass: "bg-green-600 hover:bg-green-700 text-white",
        comingSoon: true,
        note: "Android edition coming soon",
    },
];

export function DownloadSection() {
    return (
        <section id="download" className="section-padding bg-gradient-to-b from-background to-secondary/5 relative overflow-hidden border-t border-border/40">

            {/* Ambient Glow */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[20%] left-[10%] w-[40rem] h-[40rem] bg-primary/5 rounded-full blur-[100px] opacity-40 animate-pulse-slow"></div>
                <div className="absolute bottom-[20%] right-[10%] w-[35rem] h-[35rem] bg-accent/5 rounded-full blur-[90px] opacity-40 animate-pulse-slow delay-1000"></div>
            </div>

            <div className="section-container relative z-10">
                <div className="text-center mb-16 md:mb-20">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/20 mb-6 shadow-sm">
                        <Download size={14} className="animate-bounce" />
                        <span className="text-xs font-bold uppercase tracking-wider">Multi-Platform</span>
                    </div>
                    <h2 className="text-3xl md:text-4xl lg:text-5xl font-black tracking-tight text-foreground">
                        Install <span className="text-gradient-primary">ecbills.in</span> Locally
                    </h2>
                    <p className="mt-6 max-w-2xl mx-auto text-lg text-muted-foreground leading-relaxed">
                        Download the desktop scanner bridge — it pairs with this billing page over localhost so any USB
                        barcode/QR scanner auto-adds products to the bill.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 px-2 md:px-0">
                    {platforms.map((platform) => (
                        <div
                            key={platform.name}
                            className={cn(
                                "bg-card/50 backdrop-blur-sm border border-border/60 p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 group flex flex-col items-center text-center",
                                platform.hoverBorder
                            )}
                        >
                            <div className={cn("p-5 rounded-2xl mb-5 transition-transform duration-300 group-hover:scale-110 shadow-inner", platform.bgColor)}>
                                <platform.icon className={cn("w-10 h-10", platform.color)} />
                            </div>
                            <h3 className="text-xl font-bold mb-2">{platform.name}</h3>
                            <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest opacity-70 mb-3">{platform.version}</p>
                            <p className="text-muted-foreground text-sm mb-5 flex-grow leading-relaxed px-2">{platform.description}</p>

                            <div className="w-full mt-auto space-y-3">
                                <div className="w-full text-center text-xs font-medium text-muted-foreground">
                                    {platform.note}
                                </div>

                                {platform.comingSoon || !platform.downloadUrl ? (
                                    <div className="w-full text-center text-sm font-medium text-muted-foreground border border-dashed border-border/60 rounded-lg py-2.5">
                                        Coming Soon...
                                    </div>
                                ) : (
                                    <Button asChild className={cn("w-full", platform.btnClass)} size="lg">
                                        <a href={platform.downloadUrl} download={platform.fileName}>
                                            <Download className="mr-2 h-4 w-4" /> Download for {platform.name}
                                        </a>
                                    </Button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-16 text-center">
                    <Button asChild variant="ghost">
                        <a href="/download">
                            How it pairs with your browser <ArrowRight className="ml-2 h-4 w-4" />
                        </a>
                    </Button>
                    <p className="mt-4 text-sm text-muted-foreground">
                        Looking for the web version? <a href="/storeportal" className="text-primary hover:underline font-medium cursor-pointer">Continue to Browser Store Portal</a>
                    </p>
                </div>
            </div>
        </section>
    );
}
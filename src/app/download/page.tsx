"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Monitor, Server, Download, Radio, RadioTower, CheckCircle2, Bluetooth, ShieldCheck, ArrowLeft } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useScannerBridge } from '@/hooks/use-scanner-bridge';
import {
  BRIDGE_DOWNLOADS,
  BRIDGE_PAIRING_STEPS,
  SCANNER_BRIDGE_VERSION,
  SCANNER_BRIDGE_WS_URL,
} from '@/lib/scanner-bridge-downloads';
import { LandingHeader } from '@/components/landing/LandingHeader';
import { LandingFooter } from '@/components/landing/LandingFooter';

export default function BridgeDownloadPage() {
  const router = useRouter();
  const { connected, captureMode, version } = useScannerBridge();

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <LandingHeader
        onAdminLoginClick={() => router.push('/admin')}
        onStoreLoginClick={() => router.push('/storeportal')}
      />
      <main className="flex-grow section-padding">
        <div className="section-container">
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary mb-6">
            <ArrowLeft className="h-4 w-4" /> Back to home
          </Link>

          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/20 mb-5 shadow-sm">
              <Bluetooth className="h-4 w-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Barcode Scanner Bridge</span>
            </div>
            <h1 className="text-3xl md:text-5xl font-black tracking-tight text-foreground">
              Auto-bill with any <span className="text-gradient-primary">USB scanner</span>
            </h1>
            <p className="mt-6 max-w-2xl mx-auto text-lg text-muted-foreground leading-relaxed">
              Install the small companion app for {BRIDGE_DOWNLOADS.map((d) => d.label).join(' or ')}. It pairs with this billing
              page over localhost ({SCANNER_BRIDGE_WS_URL}), so every barcode/QR you scan is added to the bill instantly.
            </p>
          </div>

          {/* Live pairing status */}
          <Card className="mx-auto max-w-2xl mb-10 rounded-2xl shadow-lg border-t-2 border-t-primary">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  {connected ? (
                    <CheckCircle2 className="h-8 w-8 shrink-0 text-emerald-500" />
                  ) : (
                    <RadioTower className="h-8 w-8 shrink-0 text-amber-500" />
                  )}
                  <div className="min-w-0">
                    <div className="font-semibold">
                      {connected ? "Bridge detected on this computer" : "Bridge not detected yet"}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {connected
                        ? `Paired via ${SCANNER_BRIDGE_WS_URL} · ${captureMode === 'global' ? 'global capture' : 'portal capture'}${version ? ` · v${version}` : ''}`
                        : `Listening on ${SCANNER_BRIDGE_WS_URL}. Download the edition below, start it, then refresh this page.`}
                    </p>
                  </div>
                </div>
                <Badge variant={connected ? 'default' : 'outline'} className="shrink-0">
                  {connected ? 'Online' : 'Offline'}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Downloads */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {(() => {
              const icons: Record<string, typeof Monitor> = { windows: Monitor, linux: Server };
              const tones: Record<string, string> = {
                windows: 'bg-blue-500/10 text-blue-500 border-blue-500/30',
                linux: 'bg-orange-500/10 text-orange-500 border-orange-500/30',
              };
              return BRIDGE_DOWNLOADS.map((dl) => {
                const Icon = icons[dl.platform];
                return (
                  <div
                    key={dl.platform}
                    className="flex flex-col border border-border/60 bg-card/50 backdrop-blur-sm rounded-2xl p-6 shadow-sm hover:shadow-lg transition-all duration-300 group"
                  >
                    <div className={`inline-flex self-start p-4 rounded-2xl mb-4 border ${tones[dl.platform]}`}>
                      <Icon className="h-8 w-8" />
                    </div>
                    <h3 className="text-xl font-bold">{dl.label} Edition</h3>
                    <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest mt-1">{dl.fileName}</p>
                    <p className="text-muted-foreground text-sm mt-3 flex-grow leading-relaxed">{dl.description}</p>
                    <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5" /> {dl.requirements} · v{SCANNER_BRIDGE_VERSION}
                    </p>
                    <Button asChild className="mt-5 w-full" size="lg">
                      <a href={dl.url} download={dl.fileName}>
                        <Download className="mr-2 h-4 w-4" /> Download for {dl.label}
                      </a>
                    </Button>
                  </div>
                );
              });
            })()}
          </div>

          {/* Pairing steps */}
          <div className="mt-14 max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 mb-6">
              <Radio className="h-4 w-4 text-primary" />
              <h2 className="text-2xl font-bold">How it pairs with your browser</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {BRIDGE_PAIRING_STEPS.map((step, i) => (
                <div key={step.title} className="rounded-xl border border-border/60 p-5 bg-card/40">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                      {i + 1}
                    </span>
                    <h3 className="font-semibold">{step.title}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
                </div>
              ))}
            </div>
            <div className="mt-10 text-center">
              <Button asChild variant="outline" size="lg">
                <Link href="/storeportal">Continue to Browser Store Portal</Link>
              </Button>
            </div>
          </div>
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}
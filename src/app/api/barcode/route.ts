import { NextRequest, NextResponse } from 'next/server';
import bwipjs from 'bwip-js';
import QRCode from 'qrcode';

export const dynamic = 'force-dynamic';

const routeNamePrefix = "[API_BARCODE /api/barcode]";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const text = (searchParams.get('text') || '').trim();
    const type = searchParams.get('type') || 'barcode';

    if (!text) {
      return NextResponse.json({ success: false, message: 'text query parameter is required.' }, { status: 400 });
    }

    if (type === 'qr') {
      const dataUrl = await QRCode.toDataURL(text, { width: 320, margin: 1, errorCorrectionLevel: 'M' });
      return NextResponse.json({ success: true, dataUrl });
    }

    const png = await bwipjs.toBuffer({
      bcid: 'code128',
      text,
      scale: 3,
      height: 15,
      includetext: true,
      textxalign: 'center',
      backgroundcolor: 'ffffff',
    });
    const dataUrl = `data:image/png;base64,${png.toString('base64')}`;
    return NextResponse.json({ success: true, dataUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Barcode generation failed.';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
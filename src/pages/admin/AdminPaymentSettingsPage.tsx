import { useState, useEffect, useCallback } from 'react'
import { Save, Loader2, Settings2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import type { PaymentSetting } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate } from '@/lib/utils'

export function AdminPaymentSettingsPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const fetchSettings = useCallback(async () => {
    const { data, error } = await supabase.from('payment_settings').select('*')
    if (error) {
      toast('Failed to load settings', 'error')
    } else if (data) {
      const map: Record<string, string> = {}
      for (const s of data as PaymentSetting[]) {
        map[s.setting_key] = s.setting_value ?? ''
      }
      setSettings(map)
    }
    setLoading(false)
  }, [toast])

  useEffect(() => { fetchSettings() }, [fetchSettings])

  const handleSave = async () => {
    setSaving(true)
    const updates = Object.entries(settings).map(([key, value]) =>
      supabase.from('payment_settings')
        .update({ setting_value: value, updated_by: user?.id, updated_at: new Date().toISOString() })
        .eq('setting_key', key)
    )
    await Promise.all(updates)
    toast('Payment settings saved', 'success')
    await supabase.rpc('admin_log_action', { p_action: 'payment_settings_updated' })
    setSaving(false)
  }

  if (loading) {
    return (
      <div>
        <h1 className="font-serif text-2xl font-semibold mb-6">Payment Settings</h1>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="font-serif text-2xl font-semibold mb-6">Payment Settings</h1>
      <p className="text-sm text-muted-foreground mb-6">
        These values are shown to readers during checkout. They are snapshotted at the time of each payment request,
        so changing them here does not affect existing requests.
      </p>

      <div className="space-y-6 max-w-2xl">
        {/* UPI Settings */}
        <Card>
          <CardHeader><CardTitle>UPI Settings</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>UPI ID</Label>
              <Input value={settings.upi_id ?? ''} onChange={(e) => setSettings(s => ({ ...s, upi_id: e.target.value }))} placeholder="delulu@upi" />
            </div>
            <div className="space-y-2">
              <Label>UPI QR Code URL</Label>
              <Input value={settings.upi_qr_url ?? ''} onChange={(e) => setSettings(s => ({ ...s, upi_qr_url: e.target.value }))} placeholder="https://..." />
            </div>
            <div className="space-y-2">
              <Label>Business Name</Label>
              <Input value={settings.business_name ?? ''} onChange={(e) => setSettings(s => ({ ...s, business_name: e.target.value }))} placeholder="DELULU" />
            </div>
          </CardContent>
        </Card>

        {/* PayPal Settings */}
        <Card>
          <CardHeader><CardTitle>PayPal Settings</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>PayPal Email</Label>
              <Input value={settings.paypal_email ?? ''} onChange={(e) => setSettings(s => ({ ...s, paypal_email: e.target.value }))} placeholder="business@paypal.com" />
            </div>
            <div className="space-y-2">
              <Label>PayPal.me Link</Label>
              <Input value={settings.paypal_me_link ?? ''} onChange={(e) => setSettings(s => ({ ...s, paypal_me_link: e.target.value }))} placeholder="paypal.me/delulu" />
            </div>
            <div className="space-y-2">
              <Label>PayPal QR Code URL (optional)</Label>
              <Input value={settings.paypal_qr_url ?? ''} onChange={(e) => setSettings(s => ({ ...s, paypal_qr_url: e.target.value }))} placeholder="https://..." />
            </div>
          </CardContent>
        </Card>

        {/* General Settings */}
        <Card>
          <CardHeader><CardTitle>General Settings</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Payment Instructions</Label>
              <Textarea
                value={settings.payment_instructions ?? ''}
                onChange={(e) => setSettings(s => ({ ...s, payment_instructions: e.target.value }))}
                rows={3}
                placeholder="Pay to the UPI ID above and upload the screenshot."
              />
            </div>
            <div className="space-y-2">
              <Label>Support Email</Label>
              <Input value={settings.support_email ?? ''} onChange={(e) => setSettings(s => ({ ...s, support_email: e.target.value }))} placeholder="support@delulu.com" />
            </div>
            <div className="space-y-2">
              <Label>Payment Notes</Label>
              <Textarea
                value={settings.payment_notes ?? ''}
                onChange={(e) => setSettings(s => ({ ...s, payment_notes: e.target.value }))}
                rows={2}
                placeholder="Additional notes shown to users during checkout"
              />
            </div>
          </CardContent>
        </Card>

        {/* Currency Settings */}
        <Card>
          <CardHeader><CardTitle>International Currency</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>International Currency Code</Label>
              <Input value={settings.intl_currency ?? ''} onChange={(e) => setSettings(s => ({ ...s, intl_currency: e.target.value }))} placeholder="USD" />
            </div>
            <div className="space-y-2">
              <Label>International Price Label</Label>
              <Input value={settings.intl_price_label ?? ''} onChange={(e) => setSettings(s => ({ ...s, intl_price_label: e.target.value }))} placeholder="$2.99" />
            </div>
          </CardContent>
        </Card>

        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save All Settings
        </Button>
      </div>
    </div>
  )
}

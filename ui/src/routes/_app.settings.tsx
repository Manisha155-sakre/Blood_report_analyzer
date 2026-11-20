import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  User, Check, Loader2, Sliders, Bell,
  Cpu, Building, Mail, Briefcase, Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/common/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api, API_BASE_URL, USE_MOCK_DATA, queryKeys } from "@/services/api";
import { useProfile } from "@/context/ProfileContext";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({
    meta: [
      { title: "Settings — HemaVision AI" },
      { name: "description", content: "Profile, analysis preferences and system information." },
      { property: "og:title", content: "Settings — HemaVision AI" },
      {
        property: "og:description",
        content: "Profile, analysis preferences and system information.",
      },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { data: healthData } = useQuery({ queryKey: queryKeys.health, queryFn: api.health });
  const { profile, settings, updateProfile, updateSettings } = useProfile();

  // ── Profile local form state ──
  const [name, setName] = useState(profile.name);
  const [role, setRole] = useState(profile.role);
  const [email, setEmail] = useState(profile.email);
  const [institution, setInstitution] = useState(profile.institution || "AI Blood Report Analyzer");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savedProfile, setSavedProfile] = useState(false);

  // Sync when profile data loads/changes
  useEffect(() => {
    if (profile) {
      setName(profile.name);
      setRole(profile.role);
      setEmail(profile.email);
      setInstitution(profile.institution || "AI Blood Report Analyzer");
    }
  }, [profile]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Full name is required.");
      return;
    }
    setSavingProfile(true);
    try {
      await updateProfile({
        name: name.trim(),
        role: role.trim(),
        email: email.trim(),
        institution: institution.trim(),
      });
      toast.success("Profile updated successfully!");
      setSavedProfile(true);
      setTimeout(() => setSavedProfile(false), 2500);
    } catch {
      toast.error("Could not save profile. Changes stored locally.");
    } finally {
      setSavingProfile(false);
    }
  };

  // ── Preferences form state ──
  const [compactTables, setCompactTables] = useState(settings.compact_tables);
  const [autoReport, setAutoReport] = useState(settings.auto_report);
  const [units, setUnits] = useState(settings.units);
  const [threshold, setThreshold] = useState(settings.confidence_threshold);
  const [showOverlay, setShowOverlay] = useState(settings.show_overlay_labels);
  const [runMorph, setRunMorph] = useState(settings.run_morphology);
  const [notifComplete, setNotifComplete] = useState(settings.notifications?.complete ?? true);
  const [notifReview, setNotifReview] = useState(settings.notifications?.review ?? true);
  const [notifFailed, setNotifFailed] = useState(settings.notifications?.failed ?? false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [savedPrefs, setSavedPrefs] = useState(false);

  useEffect(() => {
    if (settings) {
      setCompactTables(settings.compact_tables);
      setAutoReport(settings.auto_report);
      setUnits(settings.units);
      setThreshold(settings.confidence_threshold);
      setShowOverlay(settings.show_overlay_labels);
      setRunMorph(settings.run_morphology);
      setNotifComplete(settings.notifications?.complete ?? true);
      setNotifReview(settings.notifications?.review ?? true);
      setNotifFailed(settings.notifications?.failed ?? false);
    }
  }, [settings]);

  const handleSavePreferences = async () => {
    setSavingPrefs(true);
    try {
      await updateSettings({
        compact_tables: compactTables,
        auto_report: autoReport,
        units,
        confidence_threshold: threshold,
        show_overlay_labels: showOverlay,
        run_morphology: runMorph,
        notifications: {
          complete: notifComplete,
          review: notifReview,
          failed: notifFailed,
        },
      });
      toast.success("Preferences saved successfully!");
      setSavedPrefs(true);
      setTimeout(() => setSavedPrefs(false), 2500);
    } catch {
      toast.error("Could not save preferences to server. Saved locally.");
    } finally {
      setSavingPrefs(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings & Profile"
        subtitle="Manage your personal practitioner profile, diagnostic thresholds, and application preferences."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Profile Section ── */}
        <section className="panel p-6 space-y-5" aria-labelledby="profile-heading">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-teal-500/15 text-teal-400">
              <User className="size-5" />
            </span>
            <div>
              <h3 id="profile-heading" className="text-base font-bold">User Profile</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Saved practitioner identity displayed across navigation, reports, and logs
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs font-semibold">
                Full Name
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Dr. Jane Smith"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="role" className="text-xs font-semibold">
                Professional Role / Title
              </Label>
              <div className="relative">
                <Briefcase className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="e.g. Hematopathologist / Lab Researcher"
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold">
                Work Email
              </Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. researcher@hospital.org"
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="institution" className="text-xs font-semibold">
                Institution / Hospital Affiliation
              </Label>
              <div className="relative">
                <Building className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="institution"
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  placeholder="e.g. Central Diagnostic Laboratories"
                  className="pl-9"
                />
              </div>
            </div>

            <div className="pt-2">
              <Button type="submit" disabled={savingProfile} className="gap-2">
                {savingProfile ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Saving...
                  </>
                ) : savedProfile ? (
                  <>
                    <Check className="size-4 text-emerald-400" />
                    Saved!
                  </>
                ) : (
                  "Save profile"
                )}
              </Button>
            </div>
          </form>
        </section>

        {/* ── Application Preferences ── */}
        <section className="panel p-6 space-y-5" aria-labelledby="app-prefs-heading">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-sky-500/15 text-sky-400">
              <Sliders className="size-5" />
            </span>
            <div>
              <h3 id="app-prefs-heading" className="text-base font-bold">Application Preferences</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Customize data presentation and default workflow behavior
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <div className="min-w-0">
                <Label htmlFor="compact" className="text-sm font-medium">Compact tables</Label>
                <p className="mt-0.5 text-xs text-muted-foreground">Reduce row height in cell count and history tables</p>
              </div>
              <Switch id="compact" checked={compactTables} onCheckedChange={setCompactTables} />
            </div>

            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <div className="min-w-0">
                <Label htmlFor="autoreport" className="text-sm font-medium">Auto-open report</Label>
                <p className="mt-0.5 text-xs text-muted-foreground">Open download preview dialog after each completed analysis</p>
              </div>
              <Switch id="autoreport" checked={autoReport} onCheckedChange={setAutoReport} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="units" className="text-sm font-medium">Measurement units</Label>
              <Select value={units} onValueChange={(val: "si" | "conventional") => setUnits(val)}>
                <SelectTrigger id="units">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="si">SI Units (cells/µL, g/dL, fL)</SelectItem>
                  <SelectItem value="conventional">Conventional Units</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleSavePreferences}
                disabled={savingPrefs}
                className="gap-2"
              >
                {savingPrefs ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Saving...
                  </>
                ) : savedPrefs ? (
                  <>
                    <Check className="size-3.5 text-emerald-500" />
                    Saved!
                  </>
                ) : (
                  "Save preferences"
                )}
              </Button>
            </div>
          </div>
        </section>

        {/* ── Analysis Preferences ── */}
        <section className="panel p-6 space-y-5" aria-labelledby="analysis-prefs-heading">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-purple-500/15 text-purple-400">
              <Sparkles className="size-5" />
            </span>
            <div>
              <h3 id="analysis-prefs-heading" className="text-base font-bold">Analysis Parameters</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                AI inference thresholds and morphological pipeline controls
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="threshold" className="text-sm font-medium">
                YOLOv8 Detection Confidence Threshold
              </Label>
              <div className="flex items-center gap-3">
                <Input
                  id="threshold"
                  type="number"
                  min={0.1}
                  max={0.99}
                  step={0.05}
                  value={threshold}
                  onChange={(e) => setThreshold(parseFloat(e.target.value) || 0.7)}
                  className="w-32"
                />
                <span className="text-xs text-muted-foreground">Default: 0.70 (balanced precision/recall)</span>
              </div>
            </div>

            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <div className="min-w-0">
                <Label htmlFor="overlay" className="text-sm font-medium">Show bounding boxes by default</Label>
                <p className="mt-0.5 text-xs text-muted-foreground">Render colored cell markers immediately on image load</p>
              </div>
              <Switch id="overlay" checked={showOverlay} onCheckedChange={setShowOverlay} />
            </div>

            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <div className="min-w-0">
                <Label htmlFor="morph" className="text-sm font-medium">Run morphology metrics</Label>
                <p className="mt-0.5 text-xs text-muted-foreground">Calculate RBC diameter and shape factor distributions</p>
              </div>
              <Switch id="morph" checked={runMorph} onCheckedChange={setRunMorph} />
            </div>
          </div>
        </section>

        {/* ── Notifications ── */}
        <section className="panel p-6 space-y-5" aria-labelledby="notif-heading">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-amber-500/15 text-amber-400">
              <Bell className="size-5" />
            </span>
            <div>
              <h3 id="notif-heading" className="text-base font-bold">Alerts & Notifications</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Configure in-app banners and diagnostic completion alerts
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <div className="min-w-0">
                <Label htmlFor="n-complete" className="text-sm font-medium">Analysis Complete</Label>
                <p className="mt-0.5 text-xs text-muted-foreground">Notify when all image and CBC models finish processing</p>
              </div>
              <Switch id="n-complete" checked={notifComplete} onCheckedChange={setNotifComplete} />
            </div>

            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <div className="min-w-0">
                <Label htmlFor="n-review" className="text-sm font-medium">Pathologist Review Required</Label>
                <p className="mt-0.5 text-xs text-muted-foreground">Alert when abnormal morphological or hematological flags trigger</p>
              </div>
              <Switch id="n-review" checked={notifReview} onCheckedChange={setNotifReview} />
            </div>

            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <div className="min-w-0">
                <Label htmlFor="n-failed" className="text-sm font-medium">Analysis Failure</Label>
                <p className="mt-0.5 text-xs text-muted-foreground">Alert when input format is rejected or inference times out</p>
              </div>
              <Switch id="n-failed" checked={notifFailed} onCheckedChange={setNotifFailed} />
            </div>
          </div>
        </section>
      </div>

      {/* ── System Information ── */}
      <section className="panel p-6 space-y-4">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-slate-500/15 text-slate-400">
            <Cpu className="size-5" />
          </span>
          <div>
            <h3 className="text-base font-bold">System Environment</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Runtime backend status and model readiness</p>
          </div>
        </div>

        <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 pt-2">
          <Info label="Frontend Version" value={healthData?.frontendVersion ?? "1.0.0"} />
          <Info
            label="Backend API Status"
            value={<StatusPill ok={Boolean(healthData?.apiOnline)} okLabel="Connected" />}
          />
          <Info
            label="AI Model Engine"
            value={<StatusPill ok={Boolean(healthData?.detectionModel?.loaded)} okLabel="Models Loaded" />}
          />
          <Info
            label="API Gateway"
            value={
              <span className="font-mono text-xs break-all">
                {API_BASE_URL}
                {USE_MOCK_DATA && " (mock mode)"}
              </span>
            }
          />
        </dl>
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
      <dt className="text-[11px] tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="mt-1 text-sm font-semibold">{value}</dd>
    </div>
  );
}

function StatusPill({ ok, okLabel }: { ok: boolean; okLabel: string }) {
  return (
    <Badge
      variant="outline"
      className={
        ok
          ? "gap-1.5 border-emerald-500/30 bg-emerald-500/10 text-emerald-400 font-medium"
          : "gap-1.5 border-amber-500/40 bg-amber-500/15 text-amber-400 font-medium"
      }
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {ok ? okLabel : "Connecting..."}
    </Badge>
  );
}

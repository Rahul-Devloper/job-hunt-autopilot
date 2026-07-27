"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/dashboard/header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { EmailFinderCard } from "@/components/settings/email-finder-card";
import {
  EMAIL_FINDER_PROVIDERS,
  TOTAL_FREE_CREDITS,
} from "@/lib/email-finders/providers";
import { Textarea } from "@/components/ui/textarea";
import { Check, Info, Save } from "lucide-react";
import type { EmailFinderStatus } from "@/types/email-finders";

const BACKGROUND_PLACEHOLDER = `Summary: [2-3 sentences about your experience — years, core stack, and a standout project you built.]

Skills & Technologies: [List every language, framework, database, and tool you know — e.g. React, TypeScript, Node.js, PostgreSQL, Docker.]

Education: [Your degree(s), institution, and any distinction.]`;

export default function SettingsPage() {
  const [userEmail, setUserEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [finderStatuses, setFinderStatuses] = useState<
    Record<string, EmailFinderStatus>
  >({});
  const [professionalSummary, setProfessionalSummary] = useState("");
  const [savingSummary, setSavingSummary] = useState(false);
  const [summarySaved, setSummarySaved] = useState(false);
  const [fullName, setFullName] = useState("");
  const [contactLine, setContactLine] = useState("");
  const [savingDetails, setSavingDetails] = useState(false);
  const [detailsSaved, setDetailsSaved] = useState(false);

  useEffect(() => {
    checkStatus();
    loadFinderStatuses();
    loadProfessionalSummary();
  }, []);

  async function checkStatus() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      setUserEmail(user.email ?? "");
    }

    setLoading(false);
  }

  async function loadProfessionalSummary() {
    try {
      const response = await fetch("/api/settings/profile");
      const data = await response.json();
      if (data.success) {
        setProfessionalSummary(data.data.professional_summary || "");
        setFullName(data.data.full_name);
        setContactLine(data.data.contact_line);
      }
    } catch {}
  }

  async function handleSaveSummary() {
    setSavingSummary(true);
    setSummarySaved(false);
    try {
      await fetch("/api/settings/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ professional_summary: professionalSummary }),
      });
      setSummarySaved(true);
      setTimeout(() => setSummarySaved(false), 3000);
    } catch {
      alert("Failed to save summary");
    } finally {
      setSavingSummary(false);
    }
  }

  async function handleSaveDetails() {
    setSavingDetails(true);
    setDetailsSaved(false);
    try {
      await fetch("/api/settings/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName,
          contact_line: contactLine,
        }),
      });
      setDetailsSaved(true);
      setTimeout(() => setDetailsSaved(false), 3000);
    } catch {
      alert("Failed to save details");
    } finally {
      setSavingDetails(false);
    }
  }

  async function loadFinderStatuses() {
    try {
      const response = await fetch("/api/settings/email-finders");
      const data = await response.json();
      if (data.success) {
        setFinderStatuses(data.data);
      }
    } catch {}
  }

  async function handleSaveProvider(
    providerId: string,
    credentials: Record<string, string>,
  ) {
    const response = await fetch("/api/settings/email-finders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: providerId, ...credentials }),
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.error?.message || "Failed to save");
    await loadFinderStatuses();
  }

  async function handleRemoveProvider(providerId: string) {
    const response = await fetch(`/api/settings/email-finders/${providerId}`, {
      method: "DELETE",
    });
    const data = await response.json();
    if (!data.success)
      throw new Error(data.error?.message || "Failed to remove");
    await loadFinderStatuses();
  }

  const connectedCount = EMAIL_FINDER_PROVIDERS.filter(
    (p) => finderStatuses[p.id]?.connected,
  ).length;

  if (loading) {
    return (
      <div className="flex h-full flex-col">
        <Header
          title="Settings"
          description="Configure your account and integrations"
        />
        <div className="flex flex-1 items-center justify-center">
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <Header
        title="Settings"
        description="Configure your account and integrations"
      />

      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-2xl space-y-6">
          {userEmail && (
            <Card>
              <CardHeader>
                <CardTitle>Account</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-700">
                  <span className="font-medium">Signed in as:</span> {userEmail}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Email Finder Marketplace */}
          <Card>
            <CardHeader>
              <CardTitle>Email Finder Integrations</CardTitle>
              <CardDescription>
                Connect email finder services to automatically discover hiring
                contacts. Keys are encrypted before storage.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Summary */}
              <Alert className="bg-blue-50 border-blue-200">
                <Info className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800 text-sm">
                  <strong>
                    Up to {TOTAL_FREE_CREDITS} free searches/month
                  </strong>{" "}
                  when all 3 providers are connected.
                  {connectedCount > 0 && (
                    <span className="ml-1 text-blue-700">
                      ({connectedCount} of {EMAIL_FINDER_PROVIDERS.length}{" "}
                      connected)
                    </span>
                  )}
                  <br />
                  <span className="text-xs">
                    The app tries Snov.io → GetProspect → Hunter.io until 4
                    contacts are found.
                  </span>
                </AlertDescription>
              </Alert>

              {/* Provider cards */}
              <div className="space-y-3">
                {EMAIL_FINDER_PROVIDERS.map((provider) => (
                  <EmailFinderCard
                    key={provider.id}
                    provider={provider}
                    status={finderStatuses[provider.id] ?? null}
                    onSave={handleSaveProvider}
                    onRemove={handleRemoveProvider}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Your Details */}
          <Card>
            <CardHeader>
              <CardTitle>Your Details</CardTitle>
              <CardDescription>
                Used to sign off AI-drafted emails — so they never end with a
                [Your Name] placeholder.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {detailsSaved && (
                <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
                  <Check className="h-4 w-4 shrink-0" />
                  Details saved
                </div>
              )}
              <div>
                <Label htmlFor="full-name">Full Name</Label>
                <Input
                  id="full-name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="John Doe"
                />
              </div>
              <div>
                <Label htmlFor="contact-line">Contact Line</Label>
                <Input
                  id="contact-line"
                  value={contactLine}
                  onChange={(e) => setContactLine(e.target.value)}
                  placeholder="linkedin.com/in/johndoe | github.com/John-Doe"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Appended below your name in the email sign-off.
                </p>
              </div>
              <Button
                onClick={handleSaveDetails}
                disabled={savingDetails}
                size="sm"
              >
                {savingDetails ? (
                  "Saving..."
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Details
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Background */}
          <Card>
            <CardHeader>
              <CardTitle>Your Background</CardTitle>
              <CardDescription>
                Include your summary, full skills/tech list, and education. The
                AI only pulls facts from here — list every real technology so it
                never misses one and never invents one.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {summarySaved && (
                <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
                  <Check className="h-4 w-4 shrink-0" />
                  Summary saved
                </div>
              )}
              <Textarea
                rows={14}
                value={professionalSummary}
                onChange={(e) => setProfessionalSummary(e.target.value)}
                placeholder={BACKGROUND_PLACEHOLDER}
                className="text-sm font-mono"
              />
              <Button
                onClick={handleSaveSummary}
                disabled={savingSummary}
                size="sm"
              >
                {savingSummary ? (
                  "Saving..."
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Summary
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

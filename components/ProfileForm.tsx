"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, User, Home, Settings2 } from "lucide-react";

interface Family {
  id: string;
  name: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  zip?: string;
}

interface Member {
  id: string;
  name: string;
  role: string;
  age?: number;
}

interface Preferences {
  home_size?: string;
  yard_type?: string;
  dietary_notes?: string;
  reminders_enabled?: boolean;
}

interface ProfileFormProps {
  family: Family | null;
  members: Member[];
  preferences: Preferences | null;
  userEmail: string;
  isPreview?: boolean;
}

const MEMBER_COLORS = [
  "#15c489", "#6366f1", "#f59e0b", "#ec4899", "#8b5cf6", "#14b8a6"
];

export function ProfileForm({ family, members: initialMembers, preferences: initialPrefs, userEmail, isPreview }: ProfileFormProps) {
  const [familyName, setFamilyName] = useState(family?.name ?? "");
  const [neighborhood, setNeighborhood] = useState(family?.neighborhood ?? "");
  const [members, setMembers] = useState<Member[]>(initialMembers);

  // In preview mode, load from localStorage on mount
  useEffect(() => {
    if (!isPreview) return;
    const storedName = localStorage.getItem("kin_family_name");
    const storedNeighborhood = localStorage.getItem("kin_neighborhood");
    const storedMembers = localStorage.getItem("kin_members");
    if (storedName) setFamilyName(storedName);
    if (storedNeighborhood) setNeighborhood(storedNeighborhood);
    if (storedMembers) {
      try { setMembers(JSON.parse(storedMembers)); } catch {}
    }
    const storedPrefs = localStorage.getItem("kin_prefs");
    if (storedPrefs) {
      try {
        const p = JSON.parse(storedPrefs);
        if (p.home_size !== undefined) setHomeSize(p.home_size);
        if (p.yard_type !== undefined) setYardType(p.yard_type);
        if (p.dietary_notes !== undefined) setDietaryNotes(p.dietary_notes);
        if (p.reminders_enabled !== undefined) setReminders(p.reminders_enabled);
      } catch {}
    }
  }, [isPreview]);
  const [homeSize, setHomeSize] = useState(initialPrefs?.home_size ?? "");
  const [yardType, setYardType] = useState(initialPrefs?.yard_type ?? "");
  const [dietaryNotes, setDietaryNotes] = useState(initialPrefs?.dietary_notes ?? "");
  const [reminders, setReminders] = useState(initialPrefs?.reminders_enabled ?? true);

  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberRole, setNewMemberRole] = useState("member");
  const [newMemberAge, setNewMemberAge] = useState("");
  const [showAddMember, setShowAddMember] = useState(false);

  const [savingFamily, setSavingFamily] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  async function saveFamily() {
    setSavingFamily(true);
    if (isPreview) {
      localStorage.setItem("kin_family_name", familyName);
      localStorage.setItem("kin_neighborhood", neighborhood);
    } else {
      await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "family", name: familyName, neighborhood }),
      });
    }
    setSavingFamily(false);
    setSaved("family");
    setTimeout(() => setSaved(null), 2000);
  }

  async function savePreferences() {
    setSavingPrefs(true);
    if (isPreview) {
      localStorage.setItem("kin_prefs", JSON.stringify({ home_size: homeSize, yard_type: yardType, dietary_notes: dietaryNotes, reminders_enabled: reminders }));
    } else {
      await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "preferences",
          home_size: homeSize,
          yard_type: yardType,
          dietary_notes: dietaryNotes,
          reminders_enabled: reminders,
        }),
      });
    }
    setSavingPrefs(false);
    setSaved("prefs");
    setTimeout(() => setSaved(null), 2000);
  }

  async function addMember() {
    if (!newMemberName) return;
    if (isPreview) {
      const member: Member = {
        id: Date.now().toString(),
        name: newMemberName,
        role: newMemberRole,
        age: newMemberAge ? parseInt(newMemberAge) : undefined,
      };
      const updated = [...members, member];
      setMembers(updated);
      localStorage.setItem("kin_members", JSON.stringify(updated));
    } else {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "member",
          name: newMemberName,
          role: newMemberRole,
          age: newMemberAge ? parseInt(newMemberAge) : null,
        }),
      });
      const member = await res.json();
      setMembers((prev) => [...prev, member]);
    }
    setNewMemberName("");
    setNewMemberRole("member");
    setNewMemberAge("");
    setShowAddMember(false);
  }

  async function removeMember(id: string) {
    if (isPreview) {
      const updated = members.filter((m) => m.id !== id);
      setMembers(updated);
      localStorage.setItem("kin_members", JSON.stringify(updated));
    } else {
      await fetch("/api/profile", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, type: "member" }),
      });
      setMembers((prev) => prev.filter((m) => m.id !== id));
    }
  }

  return (
    <div className="space-y-6 pb-20 lg:pb-6">
      {/* Family section */}
      <Section icon={Home} title="Family details">
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-text-secondary mb-1.5">Family name</label>
            <input
              type="text"
              value={familyName}
              onChange={(e) => setFamilyName(e.target.value)}
              className="input-field"
              placeholder="The Johnsons"
            />
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1.5">Neighborhood</label>
            <input
              type="text"
              value={neighborhood}
              onChange={(e) => setNeighborhood(e.target.value)}
              className="input-field"
              placeholder="Northwest Hills"
            />
          </div>
          {userEmail && (
            <div>
              <label className="block text-xs text-text-secondary mb-1">Account email</label>
              <p className="text-sm text-text-muted">{userEmail}</p>
            </div>
          )}
          <SaveButton
            onClick={saveFamily}
            loading={savingFamily}
            saved={saved === "family"}
          />
        </div>
      </Section>

      {/* Family members */}
      <Section icon={User} title="Family members">
        <div className="space-y-2">
          {members.map((member, i) => (
            <div
              key={member.id}
              className="flex items-center gap-3 p-3 bg-surface-2 rounded-xl border border-border group"
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold text-bg shrink-0"
                style={{ backgroundColor: MEMBER_COLORS[i % MEMBER_COLORS.length] }}
              >
                {member.name[0].toUpperCase()}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-text-primary">{member.name}</p>
                <p className="text-xs text-text-muted capitalize">
                  {member.role}{member.age ? ` · ${member.age} yrs` : ""}
                </p>
              </div>
              <button
                onClick={() => removeMember(member.id)}
                className="opacity-0 group-hover:opacity-100 p-1 text-text-muted hover:text-red-400 transition-all"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}

          {showAddMember ? (
            <div className="space-y-2 pt-1 animate-slide-up">
              <input
                type="text"
                value={newMemberName}
                onChange={(e) => setNewMemberName(e.target.value)}
                placeholder="Name"
                className="input-field"
              />
              <div className="flex gap-2">
                <select
                  value={newMemberRole}
                  onChange={(e) => setNewMemberRole(e.target.value)}
                  className="flex-1 input-field"
                >
                  <option value="parent">Parent</option>
                  <option value="child">Child</option>
                  <option value="member">Member</option>
                </select>
                <input
                  type="number"
                  value={newMemberAge}
                  onChange={(e) => setNewMemberAge(e.target.value)}
                  placeholder="Age"
                  min={1}
                  max={120}
                  className="w-24 input-field"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={addMember}
                  disabled={!newMemberName}
                  className="flex-1 bg-teal hover:bg-teal-dim text-bg text-sm font-medium rounded-lg py-2 transition-colors disabled:opacity-50"
                >
                  Add
                </button>
                <button
                  onClick={() => setShowAddMember(false)}
                  className="px-3 text-sm text-text-muted hover:text-text-secondary bg-surface-2 rounded-lg border border-border"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAddMember(true)}
              className="flex items-center gap-2 w-full p-3 border border-dashed border-border rounded-xl text-sm text-text-muted hover:text-text-secondary hover:border-border-2 transition-colors"
            >
              <Plus size={14} />
              Add family member
            </button>
          )}
        </div>
      </Section>

      {/* Home & preferences */}
      <Section icon={Settings2} title="Home & preferences">
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-text-secondary mb-1.5">Home size</label>
            <select
              value={homeSize}
              onChange={(e) => setHomeSize(e.target.value)}
              className="input-field"
            >
              <option value="">Select size</option>
              <option value="small">Small (&lt;1,500 sq ft)</option>
              <option value="medium">Medium (1,500–2,500 sq ft)</option>
              <option value="large">Large (2,500–4,000 sq ft)</option>
              <option value="xlarge">Extra large (&gt;4,000 sq ft)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-text-secondary mb-1.5">Yard type</label>
            <select
              value={yardType}
              onChange={(e) => setYardType(e.target.value)}
              className="input-field"
            >
              <option value="">Select type</option>
              <option value="none">No yard</option>
              <option value="small">Small yard</option>
              <option value="medium">Medium yard</option>
              <option value="large">Large yard (½ acre+)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-text-secondary mb-1.5">Dietary notes</label>
            <input
              type="text"
              value={dietaryNotes}
              onChange={(e) => setDietaryNotes(e.target.value)}
              placeholder="e.g. nut allergy, vegetarian"
              className="input-field"
            />
          </div>

          <div className="flex items-center justify-between py-1">
            <div>
              <p className="text-sm text-text-primary">Smart reminders</p>
              <p className="text-xs text-text-muted">Kin sends proactive reminders</p>
            </div>
            <button
              onClick={() => setReminders(!reminders)}
              className={`w-10 h-6 rounded-full transition-colors relative ${
                reminders ? "bg-teal" : "bg-surface-3"
              }`}
            >
              <span
                className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                  reminders ? "translate-x-5" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          <SaveButton
            onClick={savePreferences}
            loading={savingPrefs}
            saved={saved === "prefs"}
          />
        </div>
      </Section>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-surface border border-border rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <Icon size={14} className="text-text-muted" />
        <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
      </div>
      <div className="px-4 py-4">{children}</div>
    </div>
  );
}

function SaveButton({
  onClick,
  loading,
  saved,
}: {
  onClick: () => void;
  loading: boolean;
  saved: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading || saved}
      className={`text-sm font-medium px-4 py-2 rounded-lg transition-colors ${
        saved
          ? "bg-teal/20 text-teal"
          : "bg-teal hover:bg-teal-dim text-bg disabled:opacity-50"
      }`}
    >
      {saved ? "Saved" : loading ? "Saving…" : "Save changes"}
    </button>
  );
}

import React, { useEffect, useState } from "react";
import { UserProfile } from "../types";
import { defaultProfile } from "../defaultProfile";
import { Save, Plus, Trash2, Edit3, User, Briefcase, GraduationCap, Code, ShieldCheck } from "lucide-react";

interface ProfileEditorProps {
  profile: UserProfile;
  onChange: (profile: UserProfile) => void;
}

export default function ProfileEditor({ profile, onChange }: ProfileEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempProfile, setTempProfile] = useState<UserProfile>({ ...profile });
  const [newSkill, setNewSkill] = useState("");
  const [newTool, setNewTool] = useState("");

  useEffect(() => {
    if (!isEditing) {
      setTempProfile({ ...profile });
    }
  }, [profile, isEditing]);

  const handleSave = () => {
    onChange(tempProfile);
    setIsEditing(false);
  };

  const handleReset = () => {
    if (window.confirm("Restore profile back to default OSP CAD Drafting technician template?")) {
      setTempProfile({ ...defaultProfile });
      onChange({ ...defaultProfile });
    }
  };

  const addSkill = () => {
    if (newSkill.trim() && !tempProfile.skills.includes(newSkill.trim())) {
      setTempProfile({
        ...tempProfile,
        skills: [...tempProfile.skills, newSkill.trim()]
      });
      setNewSkill("");
    }
  };

  const removeSkill = (index: number) => {
    setTempProfile({
      ...tempProfile,
      skills: tempProfile.skills.filter((_, i) => i !== index)
    });
  };

  const addTool = () => {
    if (newTool.trim() && !tempProfile.software.includes(newTool.trim())) {
      setTempProfile({
        ...tempProfile,
        software: [...tempProfile.software, newTool.trim()]
      });
      setNewTool("");
    }
  };

  const removeTool = (index: number) => {
    setTempProfile({
      ...tempProfile,
      software: tempProfile.software.filter((_, i) => i !== index)
    });
  };

  const addExperience = () => {
    setTempProfile({
      ...tempProfile,
      experience: [
        ...tempProfile.experience,
        { role: "Technical Draftsman", company: "Company Name", period: "2024 - Present", bullets: ["Authored details construction documents..."] }
      ]
    });
  };

  const updateExperience = (index: number, field: string, value: any) => {
    const updated = tempProfile.experience.map((exp, i) => {
      if (i === index) {
        return { ...exp, [field]: value };
      }
      return exp;
    });
    setTempProfile({ ...tempProfile, experience: updated });
  };

  const addExpBullet = (expIndex: number) => {
    const updated = tempProfile.experience.map((exp, i) => {
      if (i === expIndex) {
        return { ...exp, bullets: [...exp.bullets, "New technical contribution bullet item."] };
      }
      return exp;
    });
    setTempProfile({ ...tempProfile, experience: updated });
  };

  const updateExpBullet = (expIndex: number, bulletIndex: number, value: string) => {
    const updated = tempProfile.experience.map((exp, i) => {
      if (i === expIndex) {
        const updatedBullets = exp.bullets.map((b, bi) => (bi === bulletIndex ? value : b));
        return { ...exp, bullets: updatedBullets };
      }
      return exp;
    });
    setTempProfile({ ...tempProfile, experience: updated });
  };

  const removeExpBullet = (expIndex: number, bulletIndex: number) => {
    const updated = tempProfile.experience.map((exp, i) => {
      if (i === expIndex) {
        return { ...exp, bullets: exp.bullets.filter((_, bi) => bi !== bulletIndex) };
      }
      return exp;
    });
    setTempProfile({ ...tempProfile, experience: updated });
  };

  const removeExperience = (index: number) => {
    setTempProfile({
      ...tempProfile,
      experience: tempProfile.experience.filter((_, i) => i !== index)
    });
  };

  const addProject = () => {
    setTempProfile({
      ...tempProfile,
      projects: [
        ...tempProfile.projects,
        { name: "Project Name", description: "Project description...", technologies: ["AutoCAD"] }
      ]
    });
  };

  const updateProject = (index: number, field: string, value: any) => {
    const updated = tempProfile.projects.map((proj, i) => {
      if (i === index) {
        return { ...proj, [field]: value };
      }
      return proj;
    });
    setTempProfile({ ...tempProfile, projects: updated });
  };

  const removeProject = (index: number) => {
    setTempProfile({
      ...tempProfile,
      projects: tempProfile.projects.filter((_, i) => i !== index)
    });
  };

  const addCertification = () => {
    setTempProfile({
      ...tempProfile,
      certifications: [...(tempProfile.certifications || []), ""]
    });
  };

  const updateCertification = (index: number, value: string) => {
    const updated = (tempProfile.certifications || []).map((cert, i) =>
      i === index ? value : cert
    );
    setTempProfile({ ...tempProfile, certifications: updated });
  };

  const removeCertification = (index: number) => {
    setTempProfile({
      ...tempProfile,
      certifications: (tempProfile.certifications || []).filter((_, i) => i !== index)
    });
  };

  const addEducation = () => {
    setTempProfile({
      ...tempProfile,
      education: [
        ...(tempProfile.education || []),
        { degree: "", school: "", period: "", details: "" }
      ]
    });
  };

  const updateEducation = (index: number, field: "degree" | "school" | "period" | "details", value: string) => {
    const updated = (tempProfile.education || []).map((edu, i) =>
      i === index ? { ...edu, [field]: value } : edu
    );
    setTempProfile({ ...tempProfile, education: updated });
  };

  const removeEducation = (index: number) => {
    setTempProfile({
      ...tempProfile,
      education: (tempProfile.education || []).filter((_, i) => i !== index)
    });
  };

  return (
    <div id="profile-editor-card" className="bg-slate-900 border border-slate-805 rounded-md overflow-hidden shadow-sm transition-all text-slate-100">
      {/* Header */}
      <div className="px-5 py-3 border-b border-slate-800 bg-slate-950 flex justify-between items-center whitespace-nowrap">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-300">
            <User className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <h3 className="font-sans font-bold text-slate-100 text-xs uppercase font-mono">Active Draftsman Profile</h3>
            <p className="text-[10px] text-slate-450 font-mono uppercase tracking-wider">CAD Tech Baseline References</p>
          </div>
        </div>
        
        <div className="flex gap-1.5 shrink-0">
          {!isEditing ? (
            <>
              <button
                id="btn-edit-profile"
                onClick={() => {
                  setTempProfile({ ...profile });
                  setIsEditing(true);
                }}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Edit Profile Facts
              </button>
              <button
                id="btn-reset-profile"
                onClick={handleReset}
                className="px-2.5 py-1 bg-rose-950/20 hover:bg-rose-950/40 border border-rose-900 text-rose-400 hover:text-rose-350 rounded text-xs font-bold flex items-center cursor-pointer transition-colors"
              >
                Restore Defaults
              </button>
            </>
          ) : (
            <>
              <button
                id="btn-save-profile"
                onClick={handleSave}
                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors border border-blue-500"
              >
                <Save className="w-3.5 h-3.5" />
                Save Changes
              </button>
              <button
                id="btn-cancel-profile"
                onClick={() => setIsEditing(false)}
                className="px-2.5 py-1 bg-slate-955 hover:bg-slate-800 text-slate-300 rounded text-xs border border-slate-850 cursor-pointer transition-colors"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      {/* Editor Content */}
      <div className="p-4 max-h-[60vh] overflow-y-auto space-y-4 scrollbar-thin">
        
        {/* Safety Disclaimer Banner */}
        <div className="p-3 bg-blue-955/40 border border-blue-900 rounded text-xs flex items-start gap-3 text-blue-400">
          <ShieldCheck className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-300 leading-relaxed">
            <span className="font-bold text-blue-300 font-mono block">Ethical AI Protection Enabled</span> This career baseline protects you against fabricating credentials. Standard licenses, architectures degrees, or unverified software listings are prohibited to ensure 100% compliance during automatic generation steps.
          </div>
        </div>

        {/* Name and Basic Contact */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider mb-1 font-mono">Full Name</label>
            <input
              type="text"
              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-900/60 disabled:text-slate-450"
              disabled={!isEditing}
              value={isEditing ? tempProfile.name : profile.name}
              onChange={(e) => setTempProfile({ ...tempProfile, name: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider mb-1 font-mono">Email Address</label>
            <input
              type="text"
              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-900/60 disabled:text-slate-450"
              disabled={!isEditing}
              value={isEditing ? tempProfile.email : profile.email}
              onChange={(e) => setTempProfile({ ...tempProfile, email: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider mb-1 font-mono">Contact Number</label>
            <input
              type="text"
              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-900/60 disabled:text-slate-450"
              disabled={!isEditing}
              value={isEditing ? tempProfile.phone : profile.phone}
              onChange={(e) => setTempProfile({ ...tempProfile, phone: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider mb-1 font-mono">Physical Location</label>
            <input
              type="text"
              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-900/60 disabled:text-slate-450"
              disabled={!isEditing}
              value={isEditing ? tempProfile.location : profile.location}
              onChange={(e) => setTempProfile({ ...tempProfile, location: e.target.value })}
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-[10px] font-bold text-slate-455 uppercase tracking-wider mb-1 font-mono">Portfolio Web Address</label>
            <input
              type="text"
              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-900/60 disabled:text-slate-450"
              disabled={!isEditing}
              value={isEditing ? tempProfile.portfolioUrl : profile.portfolioUrl}
              onChange={(e) => setTempProfile({ ...tempProfile, portfolioUrl: e.target.value })}
            />
          </div>
        </div>

        {/* Summary Biography */}
        <div>
          <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider mb-1 font-mono">Professional Executive Summary</label>
          <textarea
            className="w-full h-24 px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-105 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-900/60 disabled:text-slate-450 resize-none font-sans leading-relaxed"
            disabled={!isEditing}
            value={isEditing ? tempProfile.summary : profile.summary}
            onChange={(e) => setTempProfile({ ...tempProfile, summary: e.target.value })}
          />
        </div>

        {/* Skills and Tools */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Core Technical Strengths */}
          <div className="p-3.5 bg-slate-950 border border-slate-850 rounded">
            <div className="flex items-center gap-2 mb-2.5">
              <Code className="w-4 h-4 text-blue-450" />
              <h4 className="font-sans font-bold text-slate-200 text-xs uppercase font-mono">Key Specialties & Methods</h4>
            </div>

            {isEditing && (
              <div className="flex gap-2 mb-2.5">
                <input
                  type="text"
                  placeholder="e.g., Underground utility design"
                  className="flex-1 px-2.5 py-1 bg-slate-900 border border-slate-800 rounded text-slate-100 text-xs focus:outline-none"
                  value={newSkill}
                  onChange={(e) => setNewSkill(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addSkill()}
                />
                <button
                  onClick={addSkill}
                  className="px-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs flex items-center justify-center cursor-pointer font-bold border border-blue-505"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="flex flex-wrap gap-1.5">
              {(isEditing ? tempProfile.skills : profile.skills).map((skill, i) => (
                <div
                  key={i}
                  className="px-2 py-0.5 bg-slate-900 border border-slate-800 text-slate-300 rounded text-xs flex items-center gap-1.5 font-sans font-medium"
                >
                  <span>{skill}</span>
                  {isEditing && (
                    <button
                      onClick={() => removeSkill(i)}
                      className="text-slate-500 hover:text-rose-500 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Software / Packages */}
          <div className="p-3.5 bg-slate-950 border border-slate-850 rounded">
            <div className="flex items-center gap-2 mb-2.5">
              <Code className="w-4 h-4 text-blue-450" />
              <h4 className="font-sans font-bold text-slate-200 text-xs uppercase font-mono">Software & Tool Stack</h4>
            </div>

            {isEditing && (
              <div className="flex gap-2 mb-2.5">
                <input
                  type="text"
                  placeholder="e.g., Revit / Architectural BIM"
                  className="flex-1 px-2.5 py-1 bg-slate-900 border border-slate-800 rounded text-slate-100 text-xs focus:outline-none"
                  value={newTool}
                  onChange={(e) => setNewTool(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addTool()}
                />
                <button
                  onClick={addTool}
                  className="px-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs flex items-center justify-center cursor-pointer font-bold border border-blue-505"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="flex flex-wrap gap-1.5">
              {(isEditing ? tempProfile.software : profile.software).map((tool, i) => (
                <div
                  key={i}
                  className="px-2 py-0.5 bg-blue-950/40 border border-blue-900 text-blue-400 rounded text-xs flex items-center gap-1.5 font-sans font-medium"
                >
                  <span>{tool}</span>
                  {isEditing && (
                    <button
                      onClick={() => removeTool(i)}
                      className="text-blue-500 hover:text-rose-550 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Experience Timeline */}
        <div className="space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Briefcase className="w-4.5 h-4.5 text-slate-400" />
              <h4 className="font-sans font-bold text-slate-100 text-xs uppercase tracking-wider font-mono">Professional Work Record</h4>
            </div>
            {isEditing && (
              <button
                onClick={addExperience}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-205 border border-slate-700 text-xs rounded flex items-center gap-1 cursor-pointer transition-colors font-semibold"
              >
                <Plus className="w-3 h-3" /> Add Employer
              </button>
            )}
          </div>

          <div className="space-y-4">
            {(isEditing ? tempProfile.experience : profile.experience).map((exp, index) => (
              <div key={index} className="p-3.5 bg-slate-950 border border-slate-850 rounded-md relative hover:border-slate-700 transition-colors">
                {isEditing && (
                  <button
                    onClick={() => removeExperience(index)}
                    className="absolute top-4 right-4 text-slate-500 hover:text-rose-500 cursor-pointer"
                    title="Remove Employer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}

                {isEditing ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] uppercase font-mono text-slate-450 font-bold mb-1">Role Title</label>
                        <input
                          type="text"
                          className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded text-slate-100 text-xs"
                          value={exp.role}
                          onChange={(e) => updateExperience(index, "role", e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase font-mono text-slate-450 font-bold mb-1">Company</label>
                        <input
                          type="text"
                          className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded text-slate-100 text-xs"
                          value={exp.company}
                          onChange={(e) => updateExperience(index, "company", e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase font-mono text-slate-450 font-bold mb-1">Timeline Period</label>
                        <input
                          type="text"
                          className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded text-slate-100 text-xs"
                          value={exp.period}
                          onChange={(e) => updateExperience(index, "period", e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="space-y-2 mt-2">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] uppercase font-mono text-slate-450 font-bold">Contribution bullets</label>
                        <button
                          onClick={() => addExpBullet(index)}
                          className="px-2 py-0.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-[10px] rounded font-bold"
                        >
                          + Bullet
                        </button>
                      </div>
                      {exp.bullets.map((bullet, bulletIdx) => (
                        <div key={bulletIdx} className="flex gap-2 items-center">
                          <input
                            type="text"
                            className="flex-1 px-2 py-1 bg-slate-900 border border-slate-800 rounded text-slate-100 text-xs"
                            value={bullet}
                            onChange={(e) => updateExpBullet(index, bulletIdx, e.target.value)}
                          />
                          <button
                            onClick={() => removeExpBullet(index, bulletIdx)}
                            className="text-slate-500 hover:text-rose-500 cursor-pointer animate-none"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1.5 font-sans">
                      <h5 className="font-bold text-slate-100 text-xs">{exp.role} <span className="text-blue-400 font-bold ml-1">@ {exp.company}</span></h5>
                      <span className="text-[10px] text-slate-450 font-mono shrink-0">{exp.period}</span>
                    </div>
                    <ul className="list-disc list-outside pl-4 space-y-1 text-xs text-slate-300 leading-normal font-sans">
                      {exp.bullets.map((bullet, inlineIdx) => (
                        <li key={inlineIdx} className="leading-relaxed">{bullet}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Education Background */}
        <div className="space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <GraduationCap className="w-4.5 h-4.5 text-slate-400" />
              <h4 className="font-sans font-bold text-slate-100 text-xs uppercase tracking-wider font-mono">Academic Training Facts</h4>
            </div>
            {isEditing && (
              <button
                type="button"
                onClick={addEducation}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs rounded flex items-center gap-1 cursor-pointer transition-colors font-semibold"
              >
                <Plus className="w-3 h-3" /> Add Education
              </button>
            )}
          </div>

          {(isEditing ? tempProfile.education : profile.education).map((edu, eduIdx) => (
            <div key={eduIdx} className="p-3.5 bg-slate-950 border border-slate-850 rounded-md relative">
              {isEditing && (
                <button
                  type="button"
                  onClick={() => removeEducation(eduIdx)}
                  className="absolute top-3.5 right-3.5 text-slate-500 hover:text-rose-500 cursor-pointer"
                  title="Remove Education"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              {isEditing ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pr-6">
                    <div>
                      <label className="block text-[10px] uppercase font-mono text-slate-450 font-bold mb-1">Degree / Program</label>
                      <input
                        type="text"
                        className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded text-slate-100 text-xs"
                        value={edu.degree}
                        onChange={(e) => updateEducation(eduIdx, "degree", e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-mono text-slate-450 font-bold mb-1">School</label>
                      <input
                        type="text"
                        className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded text-slate-100 text-xs"
                        value={edu.school}
                        onChange={(e) => updateEducation(eduIdx, "school", e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-mono text-slate-450 font-bold mb-1">Timeline Period</label>
                      <input
                        type="text"
                        className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded text-slate-100 text-xs"
                        value={edu.period}
                        onChange={(e) => updateEducation(eduIdx, "period", e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-mono text-slate-450 font-bold mb-1">Details</label>
                    <input
                      type="text"
                      className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded text-slate-100 text-xs"
                      value={edu.details || ""}
                      onChange={(e) => updateEducation(eduIdx, "details", e.target.value)}
                    />
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                    <h5 className="font-sans font-bold text-slate-100 text-xs">{edu.degree}</h5>
                    <span className="text-[10px] text-slate-450 font-mono shrink-0">{edu.period}</span>
                  </div>
                  <p className="text-xs text-slate-300 font-semibold mb-1">{edu.school}</p>
                  {edu.details && (
                    <p className="text-xs text-slate-400 leading-relaxed font-sans">{edu.details}</p>
                  )}
                </>
              )}
            </div>
          ))}
        </div>

        {/* Technical Design Projects */}
        <div className="space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <code className="text-blue-400 text-xs font-mono">&lt;/&gt;</code>
              <h4 className="font-sans font-bold text-slate-100 text-xs uppercase tracking-wider font-mono">CAD Portfolio Details</h4>
            </div>
            {isEditing && (
              <button
                onClick={addProject}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded flex items-center gap-1 border border-slate-700 cursor-pointer font-semibold"
              >
                <Plus className="w-3 h-3" /> Add Project
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(isEditing ? tempProfile.projects : profile.projects).map((proj, projIdx) => (
              <div key={projIdx} className="p-3.5 bg-slate-950 border border-slate-850 rounded-md relative hover:border-slate-700 transition-colors">
                {isEditing && (
                  <button
                    onClick={() => removeProject(projIdx)}
                    className="text-slate-500 hover:text-rose-500 cursor-pointer absolute top-4 right-4"
                    title="Remove Project"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}

                {isEditing ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] uppercase font-mono text-slate-450 font-bold mb-1">Project Name</label>
                      <input
                        type="text"
                        className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded text-slate-100 text-xs"
                        value={proj.name}
                        onChange={(e) => updateProject(projIdx, "name", e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-mono text-slate-450 font-bold mb-1">Description Reference</label>
                      <textarea
                        className="w-full h-16 px-2 py-1 bg-slate-900 border border-slate-800 rounded text-slate-100 text-xs resize-none"
                        value={proj.description}
                        onChange={(e) => updateProject(projIdx, "description", e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-mono text-slate-450 font-bold mb-1">Technologies</label>
                      <input
                        type="text"
                        className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded text-slate-100 text-xs"
                        value={(proj.technologies || []).join(", ")}
                        onChange={(e) =>
                          updateProject(
                            projIdx,
                            "technologies",
                            e.target.value
                              .split(",")
                              .map((t) => t.trim())
                              .filter(Boolean)
                          )
                        }
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <h5 className="font-sans font-bold text-slate-105 text-xs mb-1">{proj.name}</h5>
                    <p className="text-xs text-slate-350 leading-relaxed mb-2 font-sans">{proj.description}</p>
                    <div className="flex flex-wrap gap-1 font-sans">
                      {proj.technologies.map((tech, techIdx) => (
                        <span key={techIdx} className="px-1.5 py-0.5 bg-blue-955/50 border border-blue-900 text-blue-400 rounded text-[10px] font-mono font-medium">
                          {tech}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Additional Profile Details */}
        <div className="space-y-4 pt-2 border-t border-slate-800">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider mb-1 font-mono">Languages</label>
              <input
                type="text"
                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-900/60 disabled:text-slate-450"
                disabled={!isEditing}
                value={isEditing ? (tempProfile.languages || "") : (profile.languages || "")}
                onChange={(e) => setTempProfile({ ...tempProfile, languages: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider mb-1 font-mono">Work Authorization</label>
              <input
                type="text"
                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-900/60 disabled:text-slate-450"
                disabled={!isEditing}
                value={isEditing ? (tempProfile.workAuthorization || "") : (profile.workAuthorization || "")}
                onChange={(e) => setTempProfile({ ...tempProfile, workAuthorization: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider mb-1 font-mono">Target Job Titles</label>
              <input
                type="text"
                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-900/60 disabled:text-slate-450"
                disabled={!isEditing}
                value={isEditing ? (tempProfile.targetJobTitles || "") : (profile.targetJobTitles || "")}
                onChange={(e) => setTempProfile({ ...tempProfile, targetJobTitles: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider mb-1 font-mono">Work Setting Preference</label>
              <select
                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-900/60 disabled:text-slate-450"
                disabled={!isEditing}
                value={isEditing ? (tempProfile.workSettingPreference || "") : (profile.workSettingPreference || "")}
                onChange={(e) =>
                  setTempProfile({
                    ...tempProfile,
                    workSettingPreference: e.target.value as UserProfile["workSettingPreference"],
                  })
                }
              >
                <option value=""></option>
                <option value="Remote">Remote</option>
                <option value="Hybrid">Hybrid</option>
                <option value="On-site">On-site</option>
                <option value="Any">Any</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider mb-1 font-mono">Links</label>
              <input
                type="text"
                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-900/60 disabled:text-slate-450"
                disabled={!isEditing}
                value={isEditing ? (tempProfile.links || "") : (profile.links || "")}
                onChange={(e) => setTempProfile({ ...tempProfile, links: e.target.value })}
              />
            </div>
          </div>

          {/* Licenses & Certifications */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider font-mono">Licenses & Certifications</label>
              {isEditing && (
                <button
                  type="button"
                  onClick={addCertification}
                  className="px-2 py-0.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-[10px] rounded font-bold cursor-pointer"
                >
                  + License / Cert
                </button>
              )}
            </div>
            <div className="space-y-2">
              {(isEditing ? (tempProfile.certifications || []) : (profile.certifications || [])).map((cert, certIdx) => (
                <div key={certIdx} className="flex gap-2 items-center">
                  <input
                    type="text"
                    className="flex-1 px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-900/60 disabled:text-slate-450"
                    disabled={!isEditing}
                    value={cert}
                    onChange={(e) => updateCertification(certIdx, e.target.value)}
                  />
                  {isEditing && (
                    <button
                      type="button"
                      onClick={() => removeCertification(certIdx)}
                      className="text-slate-500 hover:text-rose-500 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Projects */}
          <div>
            <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider mb-1 font-mono">Projects</label>
            <textarea
              className="w-full h-24 px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-105 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-900/60 disabled:text-slate-450 resize-none font-sans leading-relaxed"
              disabled={!isEditing}
              value={isEditing ? (tempProfile.projectNotes || "") : (profile.projectNotes || "")}
              onChange={(e) => setTempProfile({ ...tempProfile, projectNotes: e.target.value })}
            />
          </div>
        </div>

      </div>
    </div>
  );
}

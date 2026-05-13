import { createHotContext as __vite__createHotContext } from "/@vite/client";import.meta.hot = __vite__createHotContext("/src/components/ProjectsPage.tsx");import __vite__cjsImport0_react_jsxDevRuntime from "/node_modules/.vite/deps/react_jsx-dev-runtime.js?v=12cb7fed"; const Fragment = __vite__cjsImport0_react_jsxDevRuntime["Fragment"]; const jsxDEV = __vite__cjsImport0_react_jsxDevRuntime["jsxDEV"];
var _s = $RefreshSig$();
import __vite__cjsImport1_react from "/node_modules/.vite/deps/react.js?v=12cb7fed"; const useState = __vite__cjsImport1_react["useState"]; const useEffect = __vite__cjsImport1_react["useEffect"]; const useCallback = __vite__cjsImport1_react["useCallback"]; const useRef = __vite__cjsImport1_react["useRef"]; const useMemo = __vite__cjsImport1_react["useMemo"];
import { Search, Plus, ChevronDown, ArrowLeft, MoreVertical, Star, ArrowUp, FileText, Trash, Pencil, MessageSquare, X, Check, Archive } from "/node_modules/.vite/deps/lucide-react.js?v=12cb7fed";
import { useNavigate } from "/node_modules/.vite/deps/react-router-dom.js?v=12cb7fed";
import { Paperclip } from "/node_modules/.vite/deps/lucide-react.js?v=12cb7fed";
import { getProjects, createProject, getProject, updateProject, deleteProject, uploadProjectFile, deleteProjectFile, createProjectConversation, deleteConversation, getSkills } from "/src/api.ts";
import ModelSelector from "/src/components/ModelSelector.tsx";
import { IconPlus } from "/src/components/Icons.tsx";
import ProjectCreateForm from "/src/components/ProjectCreateForm.tsx?t=1778651307627";
import startProjectsImg from "/src/assets/icons/start-projects.png?import";
const ProjectsPage = () => {
  _s();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [projectNameError, setProjectNameError] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentProject, setCurrentProject] = useState(null);
  const [editingInstructions, setEditingInstructions] = useState(false);
  const [instructionsText, setInstructionsText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [editName, setEditName] = useState("");
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [sortBy, setSortBy] = useState("activity");
  const [activeMenu, setActiveMenu] = useState(null);
  const [projectToDelete, setProjectToDelete] = useState(null);
  const [projectToEdit, setProjectToEdit] = useState(null);
  const [editDetailsName, setEditDetailsName] = useState("");
  const [editDetailsDesc, setEditDetailsDesc] = useState("");
  const [message, setMessage] = useState("");
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [showSkillsSubmenu, setShowSkillsSubmenu] = useState(false);
  const [enabledSkills, setEnabledSkills] = useState([]);
  const [selectedSkill, setSelectedSkill] = useState(null);
  const plusMenuRef = useRef(null);
  const plusBtnRef = useRef(null);
  const isSelfHostedMode = localStorage.getItem("user_mode") === "selfhosted";
  const selectorModels = useMemo(() => {
    if (isSelfHostedMode) {
      try {
        const chatModels = JSON.parse(localStorage.getItem("chat_models") || "[]");
        if (chatModels.length > 0) {
          const tierDescMap = {
            "opus": "Most capable for ambitious work",
            "sonnet": "Most efficient for everyday tasks",
            "haiku": "Fastest for quick answers"
          };
          return chatModels.map((m) => ({
            id: m.id,
            name: m.name || m.id,
            enabled: 1,
            tier: m.tier || "extra",
            description: m.tier && tierDescMap[m.tier] ? tierDescMap[m.tier] : void 0
          }));
        }
      } catch (_) {
      }
    }
    return [
      { id: "claude-opus-4-6", name: "Opus 4.6", enabled: 1, description: "Most capable for ambitious work" },
      { id: "claude-sonnet-4-6", name: "Sonnet 4.6", enabled: 1, description: "Most efficient for everyday tasks" },
      { id: "claude-haiku-4-5-20251001", name: "Haiku 4.5", enabled: 1, description: "Fastest for quick answers" }
    ];
  }, [isSelfHostedMode]);
  const [currentModelString, setCurrentModelString] = useState(localStorage.getItem("default_model") || "claude-sonnet-4-6");
  const handleModelChange = (newModelString) => {
    setCurrentModelString(newModelString);
  };
  const handleChatSubmit = async () => {
    if (!message.trim() || !currentProject) return;
    try {
      const conv = await createProjectConversation(currentProject.id, message.slice(0, 50), currentModelString);
      navigate(`/chat/${conv.id}`, { state: { initialMessage: message, model: currentModelString } });
      setMessage("");
    } catch (err) {
      console.error(err);
    }
  };
  const loadProjects = useCallback(async () => {
    try {
      const data = await getProjects();
      setProjects(data);
    } catch (_) {
    }
    setLoading(false);
  }, []);
  useEffect(() => {
    loadProjects();
  }, [loadProjects]);
  useEffect(() => {
    if (!showPlusMenu) {
      setShowSkillsSubmenu(false);
      return;
    }
    getSkills().then((data) => {
      const all = [...data.examples || [], ...data.my_skills || []];
      setEnabledSkills(all.filter((s) => s.enabled).map((s) => ({ id: s.id, name: s.name, description: s.description })));
    }).catch(() => {
    });
  }, [showPlusMenu]);
  useEffect(() => {
    if (!showPlusMenu) return;
    const handleClick = (e) => {
      if (plusMenuRef.current && !plusMenuRef.current.contains(e.target) && plusBtnRef.current && !plusBtnRef.current.contains(e.target)) {
        setShowPlusMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showPlusMenu]);
  const loadProject = useCallback(async (id) => {
    try {
      const data = await getProject(id);
      setCurrentProject(data);
      setInstructionsText(data.instructions || "");
    } catch (_) {
    }
  }, []);
  const handleCreate = async (e) => {
    e?.preventDefault();
    const name = projectName.trim();
    if (!name) {
      setProjectNameError("Project name is required");
      return;
    }
    try {
      const project = await createProject(name, projectDescription.trim());
      setIsCreating(false);
      setProjectName("");
      setProjectDescription("");
      setProjectNameError(null);
      loadProject(project.id);
      loadProjects();
    } catch (_) {
    }
  };
  const handleCloseCreateModal = () => {
    setIsCreating(false);
    setProjectName("");
    setProjectDescription("");
    setProjectNameError(null);
  };
  const handleDelete = async () => {
    if (!currentProject) return;
    if (!window.confirm(`确定要删除项目「${currentProject.name}」吗？所有关联的文件和对话也会被删除。`)) return;
    try {
      await deleteProject(currentProject.id);
      setCurrentProject(null);
      setShowMenu(false);
      loadProjects();
    } catch (_) {
    }
  };
  const handleDeleteProject = async (p) => {
    try {
      await deleteProject(p.id);
      if (currentProject && currentProject.id === p.id) {
        setCurrentProject(null);
      }
      setProjectToDelete(null);
      loadProjects();
    } catch (_) {
    }
  };
  const handleSaveEditDetails = async () => {
    if (!projectToEdit) return;
    try {
      await updateProject(projectToEdit.id, {
        name: editDetailsName,
        description: editDetailsDesc
      });
      setProjectToEdit(null);
      loadProjects();
      if (currentProject && currentProject.id === projectToEdit.id) {
        loadProject(currentProject.id);
      }
    } catch (_) {
    }
  };
  const handleSaveInstructions = async () => {
    if (!currentProject) return;
    await updateProject(currentProject.id, { instructions: instructionsText });
    setEditingInstructions(false);
    loadProject(currentProject.id);
  };
  const handleFileUpload = async (files) => {
    if (!currentProject) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      try {
        await uploadProjectFile(currentProject.id, file);
      } catch (_) {
      }
    }
    setUploading(false);
    loadProject(currentProject.id);
  };
  const handleDeleteFile = async (fileId) => {
    if (!currentProject) return;
    await deleteProjectFile(currentProject.id, fileId);
    loadProject(currentProject.id);
  };
  const handleNewChat = async () => {
    if (!currentProject) return;
    try {
      const conv = await createProjectConversation(currentProject.id);
      navigate(`/chat/${conv.id}`);
    } catch (_) {
    }
  };
  const handleDeleteConversation = async (convId, e) => {
    e.stopPropagation();
    if (!currentProject) return;
    try {
      await deleteConversation(convId);
      loadProject(currentProject.id);
      loadProjects();
    } catch (_) {
    }
  };
  const handleRenameSave = async () => {
    if (!currentProject || !editName.trim()) return;
    await updateProject(currentProject.id, { name: editName.trim() });
    setEditingName(false);
    loadProject(currentProject.id);
    loadProjects();
  };
  const filteredProjects = useMemo(() => {
    const filtered = projects.filter(
      (p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
    return [...filtered].sort((a, b) => {
      if (sortBy === "created") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
  }, [projects, searchQuery, sortBy]);
  if (currentProject) {
    return /* @__PURE__ */ jsxDEV("div", { className: "flex-1 h-full bg-claude-bg overflow-y-auto", children: /* @__PURE__ */ jsxDEV("div", { className: "max-w-[800px] mx-auto px-8 py-12", children: [
      /* @__PURE__ */ jsxDEV("div", { className: "mb-4", children: /* @__PURE__ */ jsxDEV(
        "button",
        {
          onClick: () => {
            setCurrentProject(null);
            loadProjects();
          },
          className: "flex items-center gap-1.5 text-[14px] text-claude-textSecondary hover:text-claude-text transition-colors font-medium -ml-1",
          children: [
            /* @__PURE__ */ jsxDEV(ArrowLeft, { size: 16 }, void 0, false, {
              fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
              lineNumber: 263,
              columnNumber: 15
            }, this),
            "All projects"
          ]
        },
        void 0,
        true,
        {
          fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
          lineNumber: 259,
          columnNumber: 13
        },
        this
      ) }, void 0, false, {
        fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
        lineNumber: 258,
        columnNumber: 11
      }, this),
      /* @__PURE__ */ jsxDEV("div", { className: "flex items-start justify-between mb-8 gap-4", children: [
        /* @__PURE__ */ jsxDEV("div", { className: "flex-1 min-w-0", children: [
          editingName ? /* @__PURE__ */ jsxDEV("div", { className: "flex items-center gap-2", children: /* @__PURE__ */ jsxDEV(
            "input",
            {
              autoFocus: true,
              value: editName,
              onChange: (e) => setEditName(e.target.value),
              onKeyDown: (e) => {
                if (e.key === "Enter") handleRenameSave();
                if (e.key === "Escape") setEditingName(false);
              },
              className: "font-[Spectral] text-[32px] text-claude-text bg-transparent border-b-2 border-claude-accent outline-none w-full",
              style: { fontWeight: 500 }
            },
            void 0,
            false,
            {
              fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
              lineNumber: 272,
              columnNumber: 19
            },
            this
          ) }, void 0, false, {
            fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
            lineNumber: 271,
            columnNumber: 15
          }, this) : /* @__PURE__ */ jsxDEV(
            "h1",
            {
              className: "font-[Spectral] text-[32px] text-claude-text leading-tight mb-2",
              style: { fontWeight: 500 },
              children: currentProject.name
            },
            void 0,
            false,
            {
              fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
              lineNumber: 282,
              columnNumber: 15
            },
            this
          ),
          currentProject.description && /* @__PURE__ */ jsxDEV("p", { className: "text-[15.5px] text-claude-textSecondary", children: currentProject.description }, void 0, false, {
            fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
            lineNumber: 290,
            columnNumber: 15
          }, this)
        ] }, void 0, true, {
          fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
          lineNumber: 269,
          columnNumber: 13
        }, this),
        /* @__PURE__ */ jsxDEV("div", { className: "flex items-center gap-1 text-claude-textSecondary mt-2 flex-shrink-0", children: /* @__PURE__ */ jsxDEV("button", { className: "p-1 hover:text-claude-text hover:bg-black/5 dark:hover:bg-white/5 rounded-md transition-colors", children: /* @__PURE__ */ jsxDEV(MoreVertical, { size: 18 }, void 0, false, {
          fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
          lineNumber: 294,
          columnNumber: 130
        }, this) }, void 0, false, {
          fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
          lineNumber: 294,
          columnNumber: 15
        }, this) }, void 0, false, {
          fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
          lineNumber: 293,
          columnNumber: 13
        }, this)
      ] }, void 0, true, {
        fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
        lineNumber: 268,
        columnNumber: 11
      }, this),
      /* @__PURE__ */ jsxDEV("div", { className: "space-y-4", children: [
        /* @__PURE__ */ jsxDEV(
          "div",
          {
            className: "bg-claude-input border border-claude-border dark:border-[#3a3a38] shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)] hover:border-[#CCC] dark:hover:border-[#5a5a58] focus-within:shadow-[0_2px_8px_rgba(0,0,0,0.08)] focus-within:border-[#CCC] dark:focus-within:border-[#5a5a58] transition-all duration-200 flex flex-col max-h-[60vh] font-sans rounded-2xl",
            children: [
              /* @__PURE__ */ jsxDEV("div", { className: "flex-1 overflow-y-auto min-h-0", children: /* @__PURE__ */ jsxDEV("div", { className: "relative", children: [
                message.match(/^\/[a-zA-Z0-9_-]+/) && /* @__PURE__ */ jsxDEV("div", { className: "pl-5 pr-4 pt-5 pb-1 text-[16px] font-sans font-[350]", style: { minHeight: "48px", position: "absolute", top: 0, left: 0, right: 0, pointerEvents: "none", whiteSpace: "pre-wrap", wordBreak: "break-word" }, "aria-hidden": true, children: (() => {
                  const m = message.match(/^(\/[a-zA-Z0-9_-]+)([\s\S]*)$/);
                  return m ? /* @__PURE__ */ jsxDEV(Fragment, { children: [
                    /* @__PURE__ */ jsxDEV("span", { className: "text-[#4B9EFA]", children: m[1] }, void 0, false, {
                      fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                      lineNumber: 308,
                      columnNumber: 102
                    }, this),
                    /* @__PURE__ */ jsxDEV("span", { className: "text-claude-text", children: m[2] }, void 0, false, {
                      fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                      lineNumber: 308,
                      columnNumber: 148
                    }, this)
                  ] }, void 0, true, {
                    fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                    lineNumber: 308,
                    columnNumber: 100
                  }, this) : null;
                })() }, void 0, false, {
                  fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                  lineNumber: 307,
                  columnNumber: 19
                }, this),
                /* @__PURE__ */ jsxDEV(
                  "textarea",
                  {
                    ref: textareaRef,
                    className: `w-full pl-5 pr-4 pt-5 pb-1 placeholder:text-claude-textSecondary text-[16px] outline-none resize-none overflow-hidden bg-transparent font-sans font-[350] ${message.match(/^\/[a-zA-Z0-9_-]+/) ? "text-transparent caret-claude-text" : "text-claude-text"}`,
                    style: { minHeight: "48px", borderRadius: "16px 16px 0 0" },
                    placeholder: selectedSkill ? `Describe what you want ${selectedSkill.name} to do...` : "How can I help you today?",
                    value: message,
                    onChange: (e) => {
                      setMessage(e.target.value);
                      e.target.style.height = "auto";
                      e.target.style.height = Math.min(e.target.scrollHeight, 300) + "px";
                      e.target.style.overflowY = e.target.scrollHeight > 300 ? "auto" : "hidden";
                    },
                    onKeyDown: (e) => {
                      if (e.key === "Backspace" && selectedSkill) {
                        const pos = e.target.selectionStart;
                        const prefix = `/${selectedSkill.slug} `;
                        if (pos > 0 && pos <= prefix.length && message.startsWith(prefix.slice(0, pos))) {
                          e.preventDefault();
                          setMessage(message.slice(prefix.length));
                          setSelectedSkill(null);
                          return;
                        }
                      }
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleChatSubmit();
                      }
                    }
                  },
                  void 0,
                  false,
                  {
                    fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                    lineNumber: 311,
                    columnNumber: 19
                  },
                  this
                )
              ] }, void 0, true, {
                fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                lineNumber: 304,
                columnNumber: 17
              }, this) }, void 0, false, {
                fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                lineNumber: 303,
                columnNumber: 15
              }, this),
              /* @__PURE__ */ jsxDEV("div", { className: "px-4 pb-3 pt-1 flex items-center justify-between flex-shrink-0", children: [
                /* @__PURE__ */ jsxDEV("div", { className: "relative flex items-center", children: [
                  /* @__PURE__ */ jsxDEV(
                    "button",
                    {
                      ref: plusBtnRef,
                      onClick: () => setShowPlusMenu((prev) => !prev),
                      className: "p-2 text-claude-textSecondary hover:text-claude-text hover:bg-claude-hover rounded-lg transition-colors",
                      children: /* @__PURE__ */ jsxDEV(IconPlus, { size: 20 }, void 0, false, {
                        fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                        lineNumber: 349,
                        columnNumber: 21
                      }, this)
                    },
                    void 0,
                    false,
                    {
                      fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                      lineNumber: 344,
                      columnNumber: 19
                    },
                    this
                  ),
                  showPlusMenu && /* @__PURE__ */ jsxDEV("div", { ref: plusMenuRef, className: "absolute bottom-full left-0 mb-2 w-[220px] bg-claude-input border border-claude-border rounded-xl shadow-[0_4px_16px_rgba(0,0,0,0.12)] py-1.5 z-50", children: [
                    /* @__PURE__ */ jsxDEV("button", { onClick: () => {
                      setShowPlusMenu(false);
                      fileInputRef.current?.click();
                    }, className: "w-full flex items-center gap-3 px-4 py-2.5 text-[13px] text-claude-text hover:bg-claude-hover transition-colors", children: [
                      /* @__PURE__ */ jsxDEV(Paperclip, { size: 16, className: "text-claude-textSecondary" }, void 0, false, {
                        fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                        lineNumber: 354,
                        columnNumber: 25
                      }, this),
                      "Add files or photos"
                    ] }, void 0, true, {
                      fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                      lineNumber: 353,
                      columnNumber: 23
                    }, this),
                    /* @__PURE__ */ jsxDEV("div", { className: "relative", children: [
                      /* @__PURE__ */ jsxDEV("button", { onMouseEnter: () => setShowSkillsSubmenu(true), onClick: () => setShowSkillsSubmenu((p) => !p), className: "w-full flex items-center justify-between px-4 py-2.5 text-[13px] text-claude-text hover:bg-claude-hover transition-colors", children: [
                        /* @__PURE__ */ jsxDEV("div", { className: "flex items-center gap-3", children: [
                          /* @__PURE__ */ jsxDEV(FileText, { size: 16, className: "text-claude-textSecondary" }, void 0, false, {
                            fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                            lineNumber: 359,
                            columnNumber: 68
                          }, this),
                          "Skills"
                        ] }, void 0, true, {
                          fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                          lineNumber: 359,
                          columnNumber: 27
                        }, this),
                        /* @__PURE__ */ jsxDEV(ChevronDown, { size: 14, className: "text-claude-textSecondary -rotate-90" }, void 0, false, {
                          fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                          lineNumber: 360,
                          columnNumber: 27
                        }, this)
                      ] }, void 0, true, {
                        fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                        lineNumber: 358,
                        columnNumber: 25
                      }, this),
                      showSkillsSubmenu && /* @__PURE__ */ jsxDEV("div", { className: "absolute left-full bottom-0 ml-1 w-[200px] bg-claude-input border border-claude-border rounded-xl shadow-[0_4px_16px_rgba(0,0,0,0.12)] py-1.5 z-50 max-h-[300px] overflow-y-auto", onMouseLeave: () => setShowSkillsSubmenu(false), children: [
                        enabledSkills.length > 0 ? enabledSkills.map(
                          (skill) => /* @__PURE__ */ jsxDEV("button", { onClick: () => {
                            setShowPlusMenu(false);
                            setShowSkillsSubmenu(false);
                            const slug = skill.name.toLowerCase().replace(/\s+/g, "-");
                            setSelectedSkill({ name: skill.name, slug, description: skill.description });
                            setMessage((prev) => prev ? `/${slug} ${prev}` : `/${slug} `);
                            textareaRef.current?.focus();
                          }, className: "w-full text-left px-4 py-2 text-[13px] text-claude-text hover:bg-claude-hover transition-colors truncate", children: skill.name }, skill.id, false, {
                            fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                            lineNumber: 365,
                            columnNumber: 25
                          }, this)
                        ) : /* @__PURE__ */ jsxDEV("div", { className: "px-4 py-2 text-[12px] text-claude-textSecondary italic", children: "No skills enabled" }, void 0, false, {
                          fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                          lineNumber: 372,
                          columnNumber: 29
                        }, this),
                        /* @__PURE__ */ jsxDEV("div", { className: "border-t border-claude-border mt-1 pt-1", children: /* @__PURE__ */ jsxDEV("button", { onClick: () => {
                          setShowPlusMenu(false);
                          window.location.hash = "#/customize";
                        }, className: "w-full flex items-center gap-3 px-4 py-2 text-[13px] text-claude-textSecondary hover:bg-claude-hover transition-colors", children: [
                          /* @__PURE__ */ jsxDEV(FileText, { size: 14 }, void 0, false, {
                            fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                            lineNumber: 374,
                            columnNumber: 249
                          }, this),
                          "Manage skills"
                        ] }, void 0, true, {
                          fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                          lineNumber: 374,
                          columnNumber: 31
                        }, this) }, void 0, false, {
                          fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                          lineNumber: 373,
                          columnNumber: 29
                        }, this)
                      ] }, void 0, true, {
                        fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                        lineNumber: 363,
                        columnNumber: 23
                      }, this)
                    ] }, void 0, true, {
                      fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                      lineNumber: 357,
                      columnNumber: 23
                    }, this)
                  ] }, void 0, true, {
                    fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                    lineNumber: 352,
                    columnNumber: 19
                  }, this)
                ] }, void 0, true, {
                  fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                  lineNumber: 343,
                  columnNumber: 17
                }, this),
                /* @__PURE__ */ jsxDEV("div", { className: "flex items-center gap-3", children: [
                  /* @__PURE__ */ jsxDEV(
                    ModelSelector,
                    {
                      currentModelString,
                      models: selectorModels,
                      onModelChange: handleModelChange,
                      isNewChat: true
                    },
                    void 0,
                    false,
                    {
                      fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                      lineNumber: 383,
                      columnNumber: 19
                    },
                    this
                  ),
                  /* @__PURE__ */ jsxDEV(
                    "button",
                    {
                      onClick: handleChatSubmit,
                      disabled: !message.trim(),
                      className: "p-2 bg-[#C6613F] text-white rounded-lg hover:bg-[#D97757] transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
                      children: /* @__PURE__ */ jsxDEV(ArrowUp, { size: 22, strokeWidth: 2.5 }, void 0, false, {
                        fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                        lineNumber: 394,
                        columnNumber: 21
                      }, this)
                    },
                    void 0,
                    false,
                    {
                      fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                      lineNumber: 389,
                      columnNumber: 19
                    },
                    this
                  )
                ] }, void 0, true, {
                  fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                  lineNumber: 382,
                  columnNumber: 17
                }, this)
              ] }, void 0, true, {
                fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                lineNumber: 342,
                columnNumber: 15
              }, this)
            ]
          },
          void 0,
          true,
          {
            fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
            lineNumber: 300,
            columnNumber: 13
          },
          this
        ),
        currentProject.conversations && currentProject.conversations.length > 0 ? /* @__PURE__ */ jsxDEV("div", { className: "border border-claude-border rounded-[16px] overflow-hidden bg-transparent mt-2", children: [
          /* @__PURE__ */ jsxDEV("div", { className: "px-5 py-3 text-[13px] font-medium text-claude-textSecondary border-b border-claude-border", children: [
            currentProject.conversations.length,
            " conversation",
            currentProject.conversations.length > 1 ? "s" : ""
          ] }, void 0, true, {
            fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
            lineNumber: 403,
            columnNumber: 17
          }, this),
          currentProject.conversations.map(
            (conv) => /* @__PURE__ */ jsxDEV(
              "div",
              {
                onClick: () => navigate(`/chat/${conv.id}`),
                className: "px-5 py-3 flex items-center gap-3 hover:bg-claude-hover cursor-pointer border-b border-claude-border last:border-b-0 transition-colors group",
                children: [
                  /* @__PURE__ */ jsxDEV(MessageSquare, { size: 16, className: "text-claude-textSecondary flex-shrink-0" }, void 0, false, {
                    fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                    lineNumber: 412,
                    columnNumber: 21
                  }, this),
                  /* @__PURE__ */ jsxDEV("span", { className: "text-[14px] text-claude-text truncate", children: conv.title }, void 0, false, {
                    fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                    lineNumber: 413,
                    columnNumber: 21
                  }, this),
                  /* @__PURE__ */ jsxDEV("span", { className: "text-[12px] text-claude-textSecondary ml-auto flex-shrink-0", children: new Date(conv.created_at).toLocaleDateString() }, void 0, false, {
                    fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                    lineNumber: 414,
                    columnNumber: 21
                  }, this),
                  /* @__PURE__ */ jsxDEV(
                    "button",
                    {
                      onClick: (e) => handleDeleteConversation(conv.id, e),
                      className: "p-1 text-claude-textSecondary hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0",
                      title: "Delete conversation",
                      children: /* @__PURE__ */ jsxDEV(Trash, { size: 14 }, void 0, false, {
                        fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                        lineNumber: 422,
                        columnNumber: 23
                      }, this)
                    },
                    void 0,
                    false,
                    {
                      fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                      lineNumber: 417,
                      columnNumber: 21
                    },
                    this
                  )
                ]
              },
              conv.id,
              true,
              {
                fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                lineNumber: 407,
                columnNumber: 15
              },
              this
            )
          )
        ] }, void 0, true, {
          fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
          lineNumber: 402,
          columnNumber: 13
        }, this) : /* @__PURE__ */ jsxDEV("div", { className: "w-full border border-claude-border rounded-[16px] px-6 py-10 flex items-center justify-center bg-transparent mt-2", children: /* @__PURE__ */ jsxDEV("span", { className: "text-[14.5px] text-[#A1A1AA]", children: "Start a chat to keep conversations organized and re-use project knowledge." }, void 0, false, {
          fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
          lineNumber: 429,
          columnNumber: 17
        }, this) }, void 0, false, {
          fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
          lineNumber: 428,
          columnNumber: 13
        }, this),
        /* @__PURE__ */ jsxDEV("div", { className: "w-full border border-claude-border rounded-[16px] overflow-hidden bg-transparent mt-2", children: [
          /* @__PURE__ */ jsxDEV(
            "div",
            {
              className: "p-5 border-b border-claude-border hover:bg-black/[0.015] dark:hover:bg-white/[0.015] transition-colors cursor-pointer group",
              onClick: () => {
                if (!editingInstructions) setEditingInstructions(true);
              },
              children: [
                /* @__PURE__ */ jsxDEV("div", { className: "flex items-center justify-between", children: [
                  /* @__PURE__ */ jsxDEV("div", { className: "flex-1", children: [
                    /* @__PURE__ */ jsxDEV("h3", { className: "font-semibold text-claude-text mb-0.5", style: { fontSize: "15.5px" }, children: "Instructions" }, void 0, false, {
                      fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                      lineNumber: 444,
                      columnNumber: 21
                    }, this),
                    !editingInstructions && /* @__PURE__ */ jsxDEV("p", { className: "text-[13px] text-[#A1A1AA]", children: currentProject.instructions ? currentProject.instructions.slice(0, 200) + (currentProject.instructions.length > 200 ? "..." : "") : "Add instructions to tailor Claude's responses" }, void 0, false, {
                      fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                      lineNumber: 446,
                      columnNumber: 21
                    }, this)
                  ] }, void 0, true, {
                    fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                    lineNumber: 443,
                    columnNumber: 19
                  }, this),
                  !editingInstructions && /* @__PURE__ */ jsxDEV("button", { className: "text-[#A1A1AA] hover:text-claude-text transition-colors", children: currentProject.instructions ? /* @__PURE__ */ jsxDEV(Pencil, { size: 18, strokeWidth: 1.5 }, void 0, false, {
                    fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                    lineNumber: 455,
                    columnNumber: 54
                  }, this) : /* @__PURE__ */ jsxDEV(Plus, { size: 22, strokeWidth: 1.5 }, void 0, false, {
                    fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                    lineNumber: 455,
                    columnNumber: 95
                  }, this) }, void 0, false, {
                    fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                    lineNumber: 454,
                    columnNumber: 19
                  }, this)
                ] }, void 0, true, {
                  fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                  lineNumber: 442,
                  columnNumber: 17
                }, this),
                editingInstructions && /* @__PURE__ */ jsxDEV(
                  "div",
                  {
                    className: "fixed inset-0 z-50 flex items-center justify-center bg-black/70",
                    onClick: () => {
                      setEditingInstructions(false);
                      setInstructionsText(currentProject.instructions || "");
                    },
                    children: /* @__PURE__ */ jsxDEV(
                      "div",
                      {
                        className: "w-full max-w-[800px] bg-white dark:bg-[#2A2928] border border-claude-border rounded-[20px] shadow-2xl p-7",
                        onClick: (e) => e.stopPropagation(),
                        children: [
                          /* @__PURE__ */ jsxDEV("h2", { className: "text-[20px] font-bold text-claude-text mb-2", children: "Set project instructions" }, void 0, false, {
                            fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                            lineNumber: 468,
                            columnNumber: 23
                          }, this),
                          /* @__PURE__ */ jsxDEV("p", { className: "text-[14px] text-[#A1A1AA] mb-5", children: [
                            "Provide Claude with relevant instructions and information for chats within ",
                            currentProject.name,
                            ". This will work alongside ",
                            /* @__PURE__ */ jsxDEV("span", { className: "underline decoration-[#555] underline-offset-2 cursor-pointer hover:text-claude-text", children: "user preferences" }, void 0, false, {
                              fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                              lineNumber: 470,
                              columnNumber: 148
                            }, this),
                            " and the selected style in a chat."
                          ] }, void 0, true, {
                            fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                            lineNumber: 469,
                            columnNumber: 23
                          }, this),
                          /* @__PURE__ */ jsxDEV(
                            "textarea",
                            {
                              autoFocus: true,
                              value: instructionsText,
                              onChange: (e) => setInstructionsText(e.target.value),
                              placeholder: "Break down large tasks and ask clarifying questions when needed.",
                              className: "w-full h-[400px] px-4 py-3 bg-claude-bg dark:bg-[#202020] border border-claude-border rounded-[12px] text-[15px] text-claude-text resize-none outline-none focus:border-[#3A7ADA] focus:ring-1 focus:ring-[#3A7ADA] transition-colors"
                            },
                            void 0,
                            false,
                            {
                              fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                              lineNumber: 473,
                              columnNumber: 23
                            },
                            this
                          ),
                          /* @__PURE__ */ jsxDEV("div", { className: "flex justify-end gap-3 mt-5", children: [
                            /* @__PURE__ */ jsxDEV(
                              "button",
                              {
                                onClick: () => {
                                  setEditingInstructions(false);
                                  setInstructionsText(currentProject.instructions || "");
                                },
                                className: "px-4 py-2 text-[14px] font-medium text-claude-text hover:bg-white/5 border border-transparent hover:border-claude-border rounded-xl transition-all",
                                children: "Cancel"
                              },
                              void 0,
                              false,
                              {
                                fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                                lineNumber: 482,
                                columnNumber: 25
                              },
                              this
                            ),
                            /* @__PURE__ */ jsxDEV(
                              "button",
                              {
                                onClick: handleSaveInstructions,
                                className: "px-4 py-2 text-[14px] font-medium bg-[#E6E6E6] text-[#222] rounded-xl hover:opacity-90 transition-opacity",
                                children: "Save instructions"
                              },
                              void 0,
                              false,
                              {
                                fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                                lineNumber: 488,
                                columnNumber: 25
                              },
                              this
                            )
                          ] }, void 0, true, {
                            fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                            lineNumber: 481,
                            columnNumber: 23
                          }, this)
                        ]
                      },
                      void 0,
                      true,
                      {
                        fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                        lineNumber: 464,
                        columnNumber: 21
                      },
                      this
                    )
                  },
                  void 0,
                  false,
                  {
                    fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                    lineNumber: 460,
                    columnNumber: 17
                  },
                  this
                )
              ]
            },
            void 0,
            true,
            {
              fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
              lineNumber: 438,
              columnNumber: 15
            },
            this
          ),
          /* @__PURE__ */ jsxDEV("div", { className: "p-5 pb-6", children: [
            /* @__PURE__ */ jsxDEV("div", { className: "flex items-center justify-between mb-4", children: [
              /* @__PURE__ */ jsxDEV("h3", { className: "font-semibold text-claude-text", style: { fontSize: "15.5px" }, children: [
                "Files ",
                currentProject.files?.length > 0 && /* @__PURE__ */ jsxDEV("span", { className: "text-claude-textSecondary text-[13px] ml-1", children: [
                  "(",
                  currentProject.files.length,
                  ")"
                ] }, void 0, true, {
                  fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                  lineNumber: 504,
                  columnNumber: 64
                }, this)
              ] }, void 0, true, {
                fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                lineNumber: 503,
                columnNumber: 19
              }, this),
              /* @__PURE__ */ jsxDEV(
                "button",
                {
                  onClick: () => fileInputRef.current?.click(),
                  className: "text-[#A1A1AA] hover:text-claude-text transition-colors",
                  children: /* @__PURE__ */ jsxDEV(Plus, { size: 22, strokeWidth: 1.5 }, void 0, false, {
                    fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                    lineNumber: 510,
                    columnNumber: 21
                  }, this)
                },
                void 0,
                false,
                {
                  fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                  lineNumber: 506,
                  columnNumber: 19
                },
                this
              ),
              /* @__PURE__ */ jsxDEV(
                "input",
                {
                  ref: fileInputRef,
                  type: "file",
                  multiple: true,
                  className: "hidden",
                  onChange: (e) => {
                    if (e.target.files) handleFileUpload(e.target.files);
                    e.target.value = "";
                  }
                },
                void 0,
                false,
                {
                  fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                  lineNumber: 512,
                  columnNumber: 19
                },
                this
              )
            ] }, void 0, true, {
              fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
              lineNumber: 502,
              columnNumber: 17
            }, this),
            uploading && /* @__PURE__ */ jsxDEV("div", { className: "text-[13px] text-claude-textSecondary animate-pulse mb-3", children: "Uploading..." }, void 0, false, {
              fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
              lineNumber: 522,
              columnNumber: 17
            }, this),
            currentProject.files && currentProject.files.length > 0 ? /* @__PURE__ */ jsxDEV("div", { className: "space-y-2", children: currentProject.files.map(
              (f) => /* @__PURE__ */ jsxDEV("div", { className: "flex items-center gap-3 px-3 py-2.5 rounded-[12px] bg-black/[0.02] dark:bg-white/[0.03] group border border-transparent hover:border-claude-border transition-all", children: [
                /* @__PURE__ */ jsxDEV(FileText, { size: 16, className: "text-[#A1A1AA] flex-shrink-0" }, void 0, false, {
                  fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                  lineNumber: 529,
                  columnNumber: 25
                }, this),
                /* @__PURE__ */ jsxDEV("div", { className: "flex-1 min-w-0", children: [
                  /* @__PURE__ */ jsxDEV("div", { className: "text-[13.5px] text-claude-text truncate font-medium", children: f.file_name }, void 0, false, {
                    fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                    lineNumber: 531,
                    columnNumber: 27
                  }, this),
                  /* @__PURE__ */ jsxDEV("div", { className: "text-[11.5px] text-[#A1A1AA]", children: f.file_size > 1024 * 1024 ? `${(f.file_size / 1024 / 1024).toFixed(1)} MB` : `${(f.file_size / 1024).toFixed(1)} KB` }, void 0, false, {
                    fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                    lineNumber: 532,
                    columnNumber: 27
                  }, this)
                ] }, void 0, true, {
                  fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                  lineNumber: 530,
                  columnNumber: 25
                }, this),
                /* @__PURE__ */ jsxDEV(
                  "button",
                  {
                    onClick: () => handleDeleteFile(f.id),
                    className: "p-1 text-[#A1A1AA] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity",
                    children: /* @__PURE__ */ jsxDEV(X, { size: 16 }, void 0, false, {
                      fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                      lineNumber: 540,
                      columnNumber: 27
                    }, this)
                  },
                  void 0,
                  false,
                  {
                    fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                    lineNumber: 536,
                    columnNumber: 25
                  },
                  this
                )
              ] }, f.id, true, {
                fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                lineNumber: 528,
                columnNumber: 19
              }, this)
            ) }, void 0, false, {
              fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
              lineNumber: 526,
              columnNumber: 17
            }, this) : /* @__PURE__ */ jsxDEV(
              "div",
              {
                className: "w-full bg-[#FAFAFA] dark:bg-[#191919] rounded-[16px] flex flex-col items-center justify-center py-8 border border-transparent dark:border-white/[0.04] cursor-pointer hover:bg-[#F3F3F3] dark:hover:bg-[#222222] transition-colors",
                onClick: () => fileInputRef.current?.click(),
                onDragOver: (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                },
                onDrop: (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (e.dataTransfer.files.length) handleFileUpload(e.dataTransfer.files);
                },
                children: [
                  /* @__PURE__ */ jsxDEV("div", { className: "flex items-center justify-center mb-3", children: /* @__PURE__ */ jsxDEV("div", { className: "w-[84px] h-[48px] relative opacity-60 mix-blend-luminosity grayscale", children: [
                    /* @__PURE__ */ jsxDEV("div", { className: "absolute right-[4px] bottom-0 w-[28px] h-[36px] bg-[#3B3B3B] border border-[#555] rounded-[4px] flex flex-col items-center py-1.5 px-1 gap-[3px] shadow-sm transform translate-x-2 translate-y-2 -rotate-12 z-0", children: [
                      /* @__PURE__ */ jsxDEV("div", { className: "w-full h-[1.5px] bg-[#666] rounded-full mx-1" }, void 0, false, {
                        fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                        lineNumber: 555,
                        columnNumber: 27
                      }, this),
                      /* @__PURE__ */ jsxDEV("div", { className: "w-3/4 h-[1.5px] bg-[#666] rounded-full mx-1 self-start" }, void 0, false, {
                        fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                        lineNumber: 556,
                        columnNumber: 27
                      }, this)
                    ] }, void 0, true, {
                      fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                      lineNumber: 554,
                      columnNumber: 25
                    }, this),
                    /* @__PURE__ */ jsxDEV("div", { className: "absolute left-[4px] bottom-0 w-[28px] h-[36px] bg-[#3B3B3B] border border-[#555] rounded-[4px] flex flex-col items-center py-1.5 px-1 gap-[3px] shadow-sm transform -translate-x-2 translate-y-1 rotate-12 z-0", children: [
                      /* @__PURE__ */ jsxDEV("div", { className: "w-full h-[1.5px] bg-[#666] rounded-full mx-1" }, void 0, false, {
                        fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                        lineNumber: 559,
                        columnNumber: 27
                      }, this),
                      /* @__PURE__ */ jsxDEV("div", { className: "w-full h-[1.5px] bg-[#666] rounded-full mx-1" }, void 0, false, {
                        fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                        lineNumber: 560,
                        columnNumber: 27
                      }, this),
                      /* @__PURE__ */ jsxDEV("div", { className: "w-1/2 h-[1.5px] bg-[#666] rounded-full mx-1 self-start" }, void 0, false, {
                        fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                        lineNumber: 561,
                        columnNumber: 27
                      }, this)
                    ] }, void 0, true, {
                      fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                      lineNumber: 558,
                      columnNumber: 25
                    }, this),
                    /* @__PURE__ */ jsxDEV("div", { className: "absolute left-1/2 bottom-0 -translate-x-1/2 w-[34px] h-[42px] bg-[#444] border border-[#666] rounded-[6px] shadow-md flex flex-col items-center py-2 px-1.5 gap-[4px] z-10", children: [
                      /* @__PURE__ */ jsxDEV("div", { className: "w-[12px] h-[12px] bg-[#555] rounded-sm flex items-center justify-center self-end mb-0.5", children: /* @__PURE__ */ jsxDEV(Plus, { size: 8, className: "text-white" }, void 0, false, {
                        fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                        lineNumber: 564,
                        columnNumber: 132
                      }, this) }, void 0, false, {
                        fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                        lineNumber: 564,
                        columnNumber: 27
                      }, this),
                      /* @__PURE__ */ jsxDEV("div", { className: "w-full h-[2px] bg-[#888] rounded-full mx-1" }, void 0, false, {
                        fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                        lineNumber: 565,
                        columnNumber: 27
                      }, this),
                      /* @__PURE__ */ jsxDEV("div", { className: "w-full h-[2px] bg-[#888] rounded-full mx-1" }, void 0, false, {
                        fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                        lineNumber: 566,
                        columnNumber: 27
                      }, this),
                      /* @__PURE__ */ jsxDEV("div", { className: "w-2/3 h-[2px] bg-[#888] rounded-full mx-1 self-start" }, void 0, false, {
                        fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                        lineNumber: 567,
                        columnNumber: 27
                      }, this)
                    ] }, void 0, true, {
                      fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                      lineNumber: 563,
                      columnNumber: 25
                    }, this)
                  ] }, void 0, true, {
                    fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                    lineNumber: 553,
                    columnNumber: 23
                  }, this) }, void 0, false, {
                    fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                    lineNumber: 552,
                    columnNumber: 21
                  }, this),
                  /* @__PURE__ */ jsxDEV("span", { className: "text-[13px] text-[#A1A1AA] text-center max-w-[200px] leading-relaxed", children: "Add PDFs, documents, or other text to reference in this project." }, void 0, false, {
                    fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                    lineNumber: 571,
                    columnNumber: 21
                  }, this)
                ]
              },
              void 0,
              true,
              {
                fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                lineNumber: 546,
                columnNumber: 17
              },
              this
            )
          ] }, void 0, true, {
            fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
            lineNumber: 501,
            columnNumber: 15
          }, this)
        ] }, void 0, true, {
          fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
          lineNumber: 436,
          columnNumber: 13
        }, this)
      ] }, void 0, true, {
        fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
        lineNumber: 298,
        columnNumber: 11
      }, this)
    ] }, void 0, true, {
      fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
      lineNumber: 257,
      columnNumber: 9
    }, this) }, void 0, false, {
      fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
      lineNumber: 256,
      columnNumber: 7
    }, this);
  }
  return /* @__PURE__ */ jsxDEV("div", { className: "flex-1 h-full bg-claude-bg overflow-y-auto", children: [
    /* @__PURE__ */ jsxDEV("div", { className: "max-w-[800px] mx-auto px-8 py-12", children: [
      /* @__PURE__ */ jsxDEV("div", { className: "flex items-center justify-between mb-8", children: [
        /* @__PURE__ */ jsxDEV("h1", { className: "font-[Spectral] text-[32px] text-claude-text", style: { fontWeight: 500 }, children: "Projects" }, void 0, false, {
          fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
          lineNumber: 589,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDEV(
          "button",
          {
            onClick: () => setIsCreating(true),
            className: "flex items-center gap-2 px-3.5 py-1.5 bg-claude-text text-claude-bg hover:opacity-90 rounded-lg transition-opacity font-medium",
            style: { fontSize: "14px" },
            children: [
              /* @__PURE__ */ jsxDEV(Plus, { size: 16, strokeWidth: 2.5 }, void 0, false, {
                fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                lineNumber: 595,
                columnNumber: 13
              }, this),
              "New project"
            ]
          },
          void 0,
          true,
          {
            fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
            lineNumber: 590,
            columnNumber: 11
          },
          this
        )
      ] }, void 0, true, {
        fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
        lineNumber: 588,
        columnNumber: 9
      }, this),
      projects.length > 0 && /* @__PURE__ */ jsxDEV(Fragment, { children: [
        /* @__PURE__ */ jsxDEV("div", { className: "relative mb-6", children: [
          /* @__PURE__ */ jsxDEV("div", { className: "absolute inset-y-0 left-3 flex items-center pointer-events-none", children: /* @__PURE__ */ jsxDEV(Search, { className: "h-5 w-5 text-claude-textSecondary opacity-80" }, void 0, false, {
            fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
            lineNumber: 604,
            columnNumber: 17
          }, this) }, void 0, false, {
            fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
            lineNumber: 603,
            columnNumber: 15
          }, this),
          /* @__PURE__ */ jsxDEV(
            "input",
            {
              type: "text",
              placeholder: "Search projects...",
              value: searchQuery,
              onChange: (e) => setSearchQuery(e.target.value),
              className: "w-full pl-10 pr-4 py-3 bg-white dark:bg-claude-input border border-gray-200 dark:border-claude-border rounded-xl text-claude-text placeholder-claude-textSecondary focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-[15px]"
            },
            void 0,
            false,
            {
              fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
              lineNumber: 606,
              columnNumber: 15
            },
            this
          )
        ] }, void 0, true, {
          fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
          lineNumber: 602,
          columnNumber: 13
        }, this),
        /* @__PURE__ */ jsxDEV("div", { className: "flex justify-end mb-6", children: /* @__PURE__ */ jsxDEV("div", { className: "flex items-center gap-3 text-[14.5px] text-[#A1A1AA] relative", children: [
          /* @__PURE__ */ jsxDEV("span", { children: "Sort by" }, void 0, false, {
            fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
            lineNumber: 617,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV(
            "button",
            {
              onClick: () => setSortMenuOpen(!sortMenuOpen),
              className: `flex items-center gap-2 text-claude-text border border-[#3A3A3A] hover:border-[#4A4A4A] dark:border-claude-border dark:hover:bg-claude-hover rounded-[10px] px-3.5 py-1.5 transition-colors ${sortMenuOpen ? "bg-claude-hover" : ""}`,
              children: [
                sortBy === "activity" ? "Activity" : sortBy === "edited" ? "Last edited" : "Date created",
                /* @__PURE__ */ jsxDEV(ChevronDown, { size: 14, className: "text-claude-textSecondary" }, void 0, false, {
                  fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                  lineNumber: 623,
                  columnNumber: 19
                }, this)
              ]
            },
            void 0,
            true,
            {
              fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
              lineNumber: 618,
              columnNumber: 17
            },
            this
          ),
          sortMenuOpen && /* @__PURE__ */ jsxDEV(Fragment, { children: [
            /* @__PURE__ */ jsxDEV("div", { className: "fixed inset-0 z-40", onClick: () => setSortMenuOpen(false) }, void 0, false, {
              fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
              lineNumber: 627,
              columnNumber: 21
            }, this),
            /* @__PURE__ */ jsxDEV("div", { className: "absolute top-full right-0 mt-1.5 w-[200px] bg-white dark:bg-[#2A2928] border border-gray-200 dark:border-claude-border rounded-[14px] shadow-lg py-1.5 z-50", children: [
              { id: "activity", label: "Recent activity" },
              { id: "edited", label: "Last edited" },
              { id: "created", label: "Date created" }
            ].map(
              (opt) => /* @__PURE__ */ jsxDEV(
                "button",
                {
                  onClick: () => {
                    setSortBy(opt.id);
                    setSortMenuOpen(false);
                  },
                  className: "w-full flex items-center justify-between px-4 py-2.5 text-[15px] text-claude-text hover:bg-black/5 dark:hover:bg-white/5 transition-colors",
                  children: [
                    opt.label,
                    sortBy === opt.id && /* @__PURE__ */ jsxDEV(Check, { size: 16, className: "text-claude-text opacity-80" }, void 0, false, {
                      fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                      lineNumber: 643,
                      columnNumber: 49
                    }, this)
                  ]
                },
                opt.id,
                true,
                {
                  fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                  lineNumber: 634,
                  columnNumber: 19
                },
                this
              )
            ) }, void 0, false, {
              fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
              lineNumber: 628,
              columnNumber: 21
            }, this)
          ] }, void 0, true, {
            fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
            lineNumber: 626,
            columnNumber: 15
          }, this)
        ] }, void 0, true, {
          fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
          lineNumber: 616,
          columnNumber: 15
        }, this) }, void 0, false, {
          fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
          lineNumber: 615,
          columnNumber: 13
        }, this)
      ] }, void 0, true, {
        fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
        lineNumber: 601,
        columnNumber: 9
      }, this),
      loading ? /* @__PURE__ */ jsxDEV("div", { className: "text-center text-claude-textSecondary text-[14px] mt-12", children: "Loading..." }, void 0, false, {
        fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
        lineNumber: 655,
        columnNumber: 9
      }, this) : filteredProjects.length > 0 ? /* @__PURE__ */ jsxDEV("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: filteredProjects.map(
        (p) => /* @__PURE__ */ jsxDEV(
          "div",
          {
            onClick: () => loadProject(p.id),
            className: "flex flex-col p-5 border border-claude-border rounded-[12px] bg-transparent hover:bg-black/[0.02] dark:hover:bg-white/[0.02] cursor-pointer transition-colors group min-h-[170px]",
            children: [
              /* @__PURE__ */ jsxDEV("div", { className: "flex items-center justify-between mb-2.5 relative", children: [
                /* @__PURE__ */ jsxDEV("div", { className: "flex items-center gap-3", children: /* @__PURE__ */ jsxDEV("h3", { className: "text-[15.5px] font-medium text-claude-text truncate", children: p.name }, void 0, false, {
                  fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                  lineNumber: 666,
                  columnNumber: 21
                }, this) }, void 0, false, {
                  fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                  lineNumber: 665,
                  columnNumber: 19
                }, this),
                /* @__PURE__ */ jsxDEV("div", { className: "relative", onClick: (e) => e.stopPropagation(), children: [
                  /* @__PURE__ */ jsxDEV(
                    "button",
                    {
                      onClick: (e) => {
                        e.stopPropagation();
                        setActiveMenu(activeMenu === p.id ? null : p.id);
                      },
                      className: `p-1 text-[#A1A1AA] hover:text-claude-text hover:bg-black/5 dark:hover:bg-white/5 rounded-[6px] transition-all ${activeMenu === p.id ? "opacity-100 bg-black/5 dark:bg-white/5" : "opacity-0 group-hover:opacity-100"}`,
                      children: /* @__PURE__ */ jsxDEV(MoreVertical, { size: 18 }, void 0, false, {
                        fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                        lineNumber: 673,
                        columnNumber: 23
                      }, this)
                    },
                    void 0,
                    false,
                    {
                      fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                      lineNumber: 669,
                      columnNumber: 21
                    },
                    this
                  ),
                  activeMenu === p.id && /* @__PURE__ */ jsxDEV(Fragment, { children: [
                    /* @__PURE__ */ jsxDEV("div", { className: "fixed inset-0 z-40", onClick: (e) => {
                      e.stopPropagation();
                      setActiveMenu(null);
                    } }, void 0, false, {
                      fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                      lineNumber: 678,
                      columnNumber: 25
                    }, this),
                    /* @__PURE__ */ jsxDEV("div", { className: "absolute top-full right-0 mt-1 w-[180px] bg-white dark:bg-[#30302E] rounded-[16px] shadow-[0_4px_24px_rgba(0,0,0,0.15)] border border-gray-200 dark:border-[#65645F] py-1.5 z-50", children: [
                      /* @__PURE__ */ jsxDEV("button", { className: "w-full flex items-center gap-3 px-4 py-2.5 text-[14px] text-claude-text hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-left", onClick: (e) => {
                        e.stopPropagation();
                        setActiveMenu(null);
                      }, children: [
                        /* @__PURE__ */ jsxDEV(Star, { size: 16, className: "text-claude-textSecondary" }, void 0, false, {
                          fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                          lineNumber: 681,
                          columnNumber: 29
                        }, this),
                        "Star"
                      ] }, void 0, true, {
                        fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                        lineNumber: 680,
                        columnNumber: 27
                      }, this),
                      /* @__PURE__ */ jsxDEV("button", { className: "w-full flex items-center gap-3 px-4 py-2.5 text-[14px] text-claude-text hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-left", onClick: (e) => {
                        e.stopPropagation();
                        setActiveMenu(null);
                        setProjectToEdit(p);
                        setEditDetailsName(p.name);
                        setEditDetailsDesc(p.description || "");
                      }, children: [
                        /* @__PURE__ */ jsxDEV(Pencil, { size: 16, className: "text-claude-textSecondary" }, void 0, false, {
                          fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                          lineNumber: 685,
                          columnNumber: 29
                        }, this),
                        "Edit details"
                      ] }, void 0, true, {
                        fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                        lineNumber: 684,
                        columnNumber: 27
                      }, this),
                      /* @__PURE__ */ jsxDEV("div", { className: "my-1.5 border-t border-claude-border opacity-50" }, void 0, false, {
                        fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                        lineNumber: 688,
                        columnNumber: 27
                      }, this),
                      /* @__PURE__ */ jsxDEV("button", { className: "w-full flex items-center gap-3 px-4 py-2.5 text-[14px] text-claude-text hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-left", onClick: (e) => {
                        e.stopPropagation();
                        setActiveMenu(null);
                      }, children: [
                        /* @__PURE__ */ jsxDEV(Archive, { size: 16, className: "text-claude-textSecondary" }, void 0, false, {
                          fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                          lineNumber: 690,
                          columnNumber: 29
                        }, this),
                        "Archive"
                      ] }, void 0, true, {
                        fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                        lineNumber: 689,
                        columnNumber: 27
                      }, this),
                      /* @__PURE__ */ jsxDEV("button", { className: "w-full flex items-center gap-3 px-4 py-2.5 text-[14px] text-[#E05A5A] hover:bg-red-500/10 transition-colors text-left", onClick: (e) => {
                        e.stopPropagation();
                        setActiveMenu(null);
                        setProjectToDelete(p);
                      }, children: [
                        /* @__PURE__ */ jsxDEV(Trash, { size: 16, className: "text-[#E05A5A]" }, void 0, false, {
                          fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                          lineNumber: 694,
                          columnNumber: 29
                        }, this),
                        "Delete"
                      ] }, void 0, true, {
                        fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                        lineNumber: 693,
                        columnNumber: 27
                      }, this)
                    ] }, void 0, true, {
                      fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                      lineNumber: 679,
                      columnNumber: 25
                    }, this)
                  ] }, void 0, true, {
                    fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                    lineNumber: 677,
                    columnNumber: 17
                  }, this)
                ] }, void 0, true, {
                  fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                  lineNumber: 668,
                  columnNumber: 19
                }, this)
              ] }, void 0, true, {
                fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                lineNumber: 664,
                columnNumber: 17
              }, this),
              /* @__PURE__ */ jsxDEV("p", { className: "text-[14px] text-claude-textSecondary line-clamp-3 leading-relaxed flex-1", children: p.description || "No description provided." }, void 0, false, {
                fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                lineNumber: 703,
                columnNumber: 17
              }, this),
              /* @__PURE__ */ jsxDEV("div", { className: "mt-4 pt-1 flex items-center gap-4 text-[12px] text-claude-textSecondary/80", children: [
                /* @__PURE__ */ jsxDEV("span", { children: [
                  "Updated ",
                  new Date(p.updated_at).toLocaleDateString()
                ] }, void 0, true, {
                  fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                  lineNumber: 708,
                  columnNumber: 19
                }, this),
                (p.file_count ?? 0) > 0 && /* @__PURE__ */ jsxDEV("span", { children: [
                  "• ",
                  p.file_count,
                  " files"
                ] }, void 0, true, {
                  fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                  lineNumber: 709,
                  columnNumber: 47
                }, this),
                (p.chat_count ?? 0) > 0 && /* @__PURE__ */ jsxDEV("span", { children: [
                  "• ",
                  p.chat_count,
                  " chats"
                ] }, void 0, true, {
                  fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                  lineNumber: 710,
                  columnNumber: 47
                }, this)
              ] }, void 0, true, {
                fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                lineNumber: 707,
                columnNumber: 17
              }, this)
            ]
          },
          p.id,
          true,
          {
            fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
            lineNumber: 659,
            columnNumber: 11
          },
          this
        )
      ) }, void 0, false, {
        fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
        lineNumber: 657,
        columnNumber: 9
      }, this) : /* @__PURE__ */ jsxDEV("div", { className: "flex flex-col items-center justify-center mt-12", children: [
        /* @__PURE__ */ jsxDEV("img", { src: startProjectsImg, alt: "Start a project", className: "w-[100px] h-auto mb-6 dark:invert opacity-90" }, void 0, false, {
          fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
          lineNumber: 717,
          columnNumber: 13
        }, this),
        /* @__PURE__ */ jsxDEV("h2", { className: "text-[17px] font-medium text-claude-text mb-3", children: "Looking to start a project?" }, void 0, false, {
          fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
          lineNumber: 718,
          columnNumber: 13
        }, this),
        /* @__PURE__ */ jsxDEV("p", { className: "text-[15px] text-claude-textSecondary text-center max-w-[400px] leading-relaxed mb-6", children: "Upload materials, set custom instructions, and organize conversations in one space." }, void 0, false, {
          fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
          lineNumber: 719,
          columnNumber: 13
        }, this),
        /* @__PURE__ */ jsxDEV(
          "button",
          {
            onClick: () => setIsCreating(true),
            className: "flex items-center gap-2 px-4 py-2 bg-transparent border border-claude-border hover:bg-claude-hover rounded-xl text-claude-text transition-colors text-[14.5px] font-medium",
            children: [
              /* @__PURE__ */ jsxDEV(Plus, { size: 18, strokeWidth: 2.5 }, void 0, false, {
                fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                lineNumber: 726,
                columnNumber: 15
              }, this),
              "New project"
            ]
          },
          void 0,
          true,
          {
            fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
            lineNumber: 722,
            columnNumber: 13
          },
          this
        )
      ] }, void 0, true, {
        fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
        lineNumber: 716,
        columnNumber: 9
      }, this)
    ] }, void 0, true, {
      fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
      lineNumber: 587,
      columnNumber: 7
    }, this),
    projectToDelete && /* @__PURE__ */ jsxDEV("div", { className: "fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4", children: /* @__PURE__ */ jsxDEV("div", { className: "bg-claude-input w-[460px] rounded-[16px] flex flex-col shadow-2xl relative border border-claude-border overflow-hidden", children: [
      /* @__PURE__ */ jsxDEV("div", { className: "px-6 pt-6 pb-4 text-left", children: [
        /* @__PURE__ */ jsxDEV("h3", { className: "text-[19px] font-semibold text-claude-text mb-3", children: "Delete project" }, void 0, false, {
          fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
          lineNumber: 737,
          columnNumber: 15
        }, this),
        /* @__PURE__ */ jsxDEV("p", { className: "text-[15px] text-claude-textSecondary leading-relaxed pr-4", children: [
          "确定要删除项目「",
          projectToDelete.name,
          "」吗？所有关联的文件和对话也会被删除。"
        ] }, void 0, true, {
          fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
          lineNumber: 738,
          columnNumber: 15
        }, this)
      ] }, void 0, true, {
        fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
        lineNumber: 736,
        columnNumber: 13
      }, this),
      /* @__PURE__ */ jsxDEV("div", { className: "px-5 pb-5 pt-2 flex justify-end gap-3 mt-4", children: [
        /* @__PURE__ */ jsxDEV(
          "button",
          {
            onClick: () => setProjectToDelete(null),
            className: "px-5 py-2 text-[14.5px] font-medium text-claude-text border border-claude-border hover:bg-claude-hover rounded-[8px] transition-colors",
            children: "Cancel"
          },
          void 0,
          false,
          {
            fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
            lineNumber: 743,
            columnNumber: 15
          },
          this
        ),
        /* @__PURE__ */ jsxDEV(
          "button",
          {
            onClick: () => handleDeleteProject(projectToDelete),
            className: "px-5 py-2 text-[14.5px] font-medium text-white bg-[#E05A5A] hover:bg-[#E86B6B] rounded-[8px] transition-colors",
            children: "Delete"
          },
          void 0,
          false,
          {
            fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
            lineNumber: 749,
            columnNumber: 15
          },
          this
        )
      ] }, void 0, true, {
        fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
        lineNumber: 742,
        columnNumber: 13
      }, this)
    ] }, void 0, true, {
      fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
      lineNumber: 735,
      columnNumber: 11
    }, this) }, void 0, false, {
      fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
      lineNumber: 734,
      columnNumber: 7
    }, this),
    projectToEdit && /* @__PURE__ */ jsxDEV("div", { className: "fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4", children: /* @__PURE__ */ jsxDEV("div", { className: "bg-claude-input w-[460px] rounded-[16px] flex flex-col shadow-2xl relative border border-claude-border overflow-hidden", children: [
      /* @__PURE__ */ jsxDEV("div", { className: "px-6 pt-6 pb-4 text-left", children: [
        /* @__PURE__ */ jsxDEV("h3", { className: "text-[19px] font-semibold text-claude-text mb-5", children: "Edit details" }, void 0, false, {
          fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
          lineNumber: 764,
          columnNumber: 15
        }, this),
        /* @__PURE__ */ jsxDEV("div", { className: "space-y-4", children: [
          /* @__PURE__ */ jsxDEV("div", { children: [
            /* @__PURE__ */ jsxDEV("label", { className: "block text-[14px] text-claude-textSecondary mb-2 font-medium", children: "Name" }, void 0, false, {
              fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
              lineNumber: 768,
              columnNumber: 19
            }, this),
            /* @__PURE__ */ jsxDEV(
              "input",
              {
                type: "text",
                value: editDetailsName,
                onChange: (e) => setEditDetailsName(e.target.value),
                className: "w-full px-3 py-2 bg-transparent border border-claude-border rounded-[8px] text-claude-text outline-none focus:border-[#3A7ADA] focus:ring-1 focus:ring-[#3A7ADA] transition-all text-[15px]",
                autoFocus: true
              },
              void 0,
              false,
              {
                fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                lineNumber: 769,
                columnNumber: 19
              },
              this
            )
          ] }, void 0, true, {
            fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
            lineNumber: 767,
            columnNumber: 17
          }, this),
          /* @__PURE__ */ jsxDEV("div", { children: [
            /* @__PURE__ */ jsxDEV("label", { className: "block text-[14px] text-claude-textSecondary mb-2 font-medium", children: "Description" }, void 0, false, {
              fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
              lineNumber: 778,
              columnNumber: 19
            }, this),
            /* @__PURE__ */ jsxDEV(
              "textarea",
              {
                value: editDetailsDesc,
                onChange: (e) => setEditDetailsDesc(e.target.value),
                rows: 4,
                className: "w-full px-3 py-2 bg-claude-bg border border-claude-border rounded-[8px] text-claude-text outline-none focus:border-[#3A7ADA] focus:ring-1 focus:ring-[#3A7ADA] transition-all resize-none text-[14.5px] leading-relaxed"
              },
              void 0,
              false,
              {
                fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
                lineNumber: 779,
                columnNumber: 19
              },
              this
            )
          ] }, void 0, true, {
            fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
            lineNumber: 777,
            columnNumber: 17
          }, this)
        ] }, void 0, true, {
          fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
          lineNumber: 766,
          columnNumber: 15
        }, this)
      ] }, void 0, true, {
        fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
        lineNumber: 763,
        columnNumber: 13
      }, this),
      /* @__PURE__ */ jsxDEV("div", { className: "px-6 pb-6 pt-2 flex justify-end gap-3 mt-4", children: [
        /* @__PURE__ */ jsxDEV(
          "button",
          {
            onClick: () => setProjectToEdit(null),
            className: "px-5 py-2.5 text-[14.5px] font-medium text-claude-text border border-claude-border hover:bg-claude-hover rounded-[8px] transition-colors",
            children: "Cancel"
          },
          void 0,
          false,
          {
            fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
            lineNumber: 790,
            columnNumber: 15
          },
          this
        ),
        /* @__PURE__ */ jsxDEV(
          "button",
          {
            onClick: handleSaveEditDetails,
            className: "px-5 py-2.5 text-[14.5px] font-medium bg-claude-text text-claude-bg hover:opacity-90 rounded-[8px] transition-opacity",
            children: "Save"
          },
          void 0,
          false,
          {
            fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
            lineNumber: 796,
            columnNumber: 15
          },
          this
        )
      ] }, void 0, true, {
        fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
        lineNumber: 789,
        columnNumber: 13
      }, this)
    ] }, void 0, true, {
      fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
      lineNumber: 762,
      columnNumber: 11
    }, this) }, void 0, false, {
      fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
      lineNumber: 761,
      columnNumber: 7
    }, this),
    isCreating && /* @__PURE__ */ jsxDEV("div", { className: "fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4", children: /* @__PURE__ */ jsxDEV("div", { className: "w-[648px] max-w-[calc(100vw-2rem)] rounded-2xl border border-claude-border bg-claude-bg shadow-xl", children: [
      /* @__PURE__ */ jsxDEV("div", { className: "flex items-start justify-between px-6 pb-4 pt-5", children: [
        /* @__PURE__ */ jsxDEV("h3", { className: "text-[22px] font-[Spectral] text-claude-text", style: { fontWeight: 600 }, children: "Create a project" }, void 0, false, {
          fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
          lineNumber: 811,
          columnNumber: 15
        }, this),
        /* @__PURE__ */ jsxDEV(
          "button",
          {
            type: "button",
            onClick: handleCloseCreateModal,
            className: "flex h-8 w-8 items-center justify-center rounded-lg text-claude-textSecondary transition-colors hover:bg-claude-hover hover:text-claude-text",
            "aria-label": "Close",
            children: /* @__PURE__ */ jsxDEV(X, { size: 18 }, void 0, false, {
              fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
              lineNumber: 818,
              columnNumber: 17
            }, this)
          },
          void 0,
          false,
          {
            fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
            lineNumber: 812,
            columnNumber: 15
          },
          this
        )
      ] }, void 0, true, {
        fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
        lineNumber: 810,
        columnNumber: 13
      }, this),
      /* @__PURE__ */ jsxDEV("div", { className: "px-6 pb-6", children: /* @__PURE__ */ jsxDEV(
        ProjectCreateForm,
        {
          onSubmit: handleCreate,
          onCancel: handleCloseCreateModal,
          projectName,
          projectDescription,
          projectNameError,
          onProjectNameChange: (value) => {
            setProjectName(value);
            if (projectNameError) setProjectNameError(null);
          },
          onProjectDescriptionChange: setProjectDescription,
          showGuide: projects.length === 0
        },
        void 0,
        false,
        {
          fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
          lineNumber: 822,
          columnNumber: 15
        },
        this
      ) }, void 0, false, {
        fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
        lineNumber: 821,
        columnNumber: 13
      }, this)
    ] }, void 0, true, {
      fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
      lineNumber: 809,
      columnNumber: 11
    }, this) }, void 0, false, {
      fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
      lineNumber: 808,
      columnNumber: 7
    }, this)
  ] }, void 0, true, {
    fileName: "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx",
    lineNumber: 586,
    columnNumber: 5
  }, this);
};
_s(ProjectsPage, "5TywW1wgS+iKGVt2IDtQFpZI3v0=", false, function() {
  return [useNavigate];
});
_c = ProjectsPage;
export default ProjectsPage;
var _c;
$RefreshReg$(_c, "ProjectsPage");
import * as RefreshRuntime from "/@react-refresh";
const inWebWorker = typeof WorkerGlobalScope !== "undefined" && self instanceof WorkerGlobalScope;
if (import.meta.hot && !inWebWorker) {
  if (!window.$RefreshReg$) {
    throw new Error(
      "@vitejs/plugin-react can't detect preamble. Something is wrong."
    );
  }
  RefreshRuntime.__hmr_import(import.meta.url).then((currentExports) => {
    RefreshRuntime.registerExportsForReactRefresh("D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx", currentExports);
    import.meta.hot.accept((nextExports) => {
      if (!nextExports) return;
      const invalidateMessage = RefreshRuntime.validateRefreshBoundaryAndEnqueueUpdate("D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx", currentExports, nextExports);
      if (invalidateMessage) import.meta.hot.invalidate(invalidateMessage);
    });
  });
}
function $RefreshReg$(type, id) {
  return RefreshRuntime.register(type, "D:/work/py/claude/claude-desktop/src/components/ProjectsPage.tsx " + id);
}
function $RefreshSig$() {
  return RefreshRuntime.createSignatureFunctionForTransform();
}

//# sourceMappingURL=data:application/json;base64,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LENBQUMrQixVQUFVO0FBQzlCeEksMkJBQWV3SSxLQUFLO0FBQ3BCLGdCQUFJckksaUJBQWtCQyxxQkFBb0IsSUFBSTtBQUFBLFVBQ2hEO0FBQUEsVUFDQSw0QkFBNEJGO0FBQUFBLFVBQzVCLFdBQVdHLFNBQVNxRCxXQUFXO0FBQUE7QUFBQSxRQVhqQztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFXbUMsS0FackM7QUFBQTtBQUFBO0FBQUE7QUFBQSxhQWNBO0FBQUEsU0ExQkY7QUFBQTtBQUFBO0FBQUE7QUFBQSxXQTJCQSxLQTVCRjtBQUFBO0FBQUE7QUFBQTtBQUFBLFdBNkJBO0FBQUEsT0EzUEo7QUFBQTtBQUFBO0FBQUE7QUFBQSxTQTZQQTtBQUVKO0FBQUVqRSxHQTl6QklELGNBQVk7QUFBQSxVQUNDaEIsV0FBVztBQUFBO0FBQUEsS0FEeEJnQjtBQWcwQk4sZUFBZUE7QUFBYSxJQUFBNkw7QUFBQSxhQUFBQSxJQUFBIiwibmFtZXMiOlsidXNlU3RhdGUiLCJ1c2VFZmZlY3QiLCJ1c2VDYWxsYmFjayIsInVzZVJlZiIsInVzZU1lbW8iLCJTZWFyY2giLCJQbHVzIiwiQ2hldnJvbkRvd24iLCJBcnJvd0xlZnQiLCJNb3JlVmVydGljYWwiLCJTdGFyIiwiQXJyb3dVcCIsIkZpbGVUZXh0IiwiVHJhc2giLCJQZW5jaWwiLCJNZXNzYWdlU3F1YXJlIiwiWCIsIkNoZWNrIiwiQXJjaGl2ZSIsInVzZU5hdmlnYXRlIiwiUGFwZXJjbGlwIiwiZ2V0UHJvamVjdHMiLCJjcmVhdGVQcm9qZWN0IiwiZ2V0UHJvamVjdCIsInVwZGF0ZVByb2plY3QiLCJkZWxldGVQcm9qZWN0IiwidXBsb2FkUHJvamVjdEZpbGUiLCJkZWxldGVQcm9qZWN0RmlsZSIsImNyZWF0ZVByb2plY3RDb252ZXJzYXRpb24iLCJkZWxldGVDb252ZXJzYXRpb24iLCJnZXRTa2lsbHMiLCJNb2RlbFNlbGVjdG9yIiwiSWNvblBsdXMiLCJQcm9qZWN0Q3JlYXRlRm9ybSIsInN0YXJ0UHJvamVjdHNJbWciLCJQcm9qZWN0c1BhZ2UiLCJfcyIsIm5hdmlnYXRlIiwic2VhcmNoUXVlcnkiLCJzZXRTZWFyY2hRdWVyeSIsImlzQ3JlYXRpbmciLCJzZXRJc0NyZWF0aW5nIiwicHJvamVjdE5hbWUiLCJzZXRQcm9qZWN0TmFtZSIsInByb2plY3REZXNjcmlwdGlvbiIsInNldFByb2plY3REZXNjcmlwdGlvbiIsInByb2plY3ROYW1lRXJyb3IiLCJzZXRQcm9qZWN0TmFtZUVycm9yIiwicHJvamVjdHMiLCJzZXRQcm9qZWN0cyIsImxvYWRpbmciLCJzZXRMb2FkaW5nIiwiY3VycmVudFByb2plY3QiLCJzZXRDdXJyZW50UHJvamVjdCIsImVkaXRpbmdJbnN0cnVjdGlvbnMiLCJzZXRFZGl0aW5nSW5zdHJ1Y3Rpb25zIiwiaW5zdHJ1Y3Rpb25zVGV4dCIsInNldEluc3RydWN0aW9uc1RleHQiLCJ1cGxvYWRpbmciLCJzZXRVcGxvYWRpbmciLCJzaG93TWVudSIsInNldFNob3dNZW51IiwiZWRpdGluZ05hbWUiLCJzZXRFZGl0aW5nTmFtZSIsImVkaXROYW1lIiwic2V0RWRpdE5hbWUiLCJzb3J0TWVudU9wZW4iLCJzZXRTb3J0TWVudU9wZW4iLCJzb3J0QnkiLCJzZXRTb3J0QnkiLCJhY3RpdmVNZW51Iiwic2V0QWN0aXZlTWVudSIsInByb2plY3RUb0RlbGV0ZSIsInNldFByb2plY3RUb0RlbGV0ZSIsInByb2plY3RUb0VkaXQiLCJzZXRQcm9qZWN0VG9FZGl0IiwiZWRpdERldGFpbHNOYW1lIiwic2V0RWRpdERldGFpbHNOYW1lIiwiZWRpdERldGFpbHNEZXNjIiwic2V0RWRpdERldGFpbHNEZXNjIiwibWVzc2FnZSIsInNldE1lc3NhZ2UiLCJmaWxlSW5wdXRSZWYiLCJ0ZXh0YXJlYVJlZiIsInNob3dQbHVzTWVudSIsInNldFNob3dQbHVzTWVudSIsInNob3dTa2lsbHNTdWJtZW51Iiwic2V0U2hvd1NraWxsc1N1Ym1lbnUiLCJlbmFibGVkU2tpbGxzIiwic2V0RW5hYmxlZFNraWxscyIsInNlbGVjdGVkU2tpbGwiLCJzZXRTZWxlY3RlZFNraWxsIiwicGx1c01lbnVSZWYiLCJwbHVzQnRuUmVmIiwiaXNTZWxmSG9zdGVkTW9kZSIsImxvY2FsU3RvcmFnZSIsImdldEl0ZW0iLCJzZWxlY3Rvck1vZGVscyIsImNoYXRNb2RlbHMiLCJKU09OIiwicGFyc2UiLCJsZW5ndGgiLCJ0aWVyRGVzY01hcCIsIm1hcCIsIm0iLCJpZCIsIm5hbWUiLCJlbmFibGVkIiwidGllciIsImRlc2NyaXB0aW9uIiwidW5kZWZpbmVkIiwiXyIsImN1cnJlbnRNb2RlbFN0cmluZyIsInNldEN1cnJlbnRNb2RlbFN0cmluZyIsImhhbmRsZU1vZGVsQ2hhbmdlIiwibmV3TW9kZWxTdHJpbmciLCJoYW5kbGVDaGF0U3VibWl0IiwidHJpbSIsImNvbnYiLCJzbGljZSIsInN0YXRlIiwiaW5pdGlhbE1lc3NhZ2UiLCJtb2RlbCIsImVyciIsImNvbnNvbGUiLCJlcnJvciIsImxvYWRQcm9qZWN0cyIsImRhdGEiLCJ0aGVuIiwiYWxsIiwiZXhhbXBsZXMiLCJteV9za2lsbHMiLCJmaWx0ZXIiLCJzIiwiY2F0Y2giLCJoYW5kbGVDbGljayIsImUiLCJjdXJyZW50IiwiY29udGFpbnMiLCJ0YXJnZXQiLCJkb2N1bWVudCIsImFkZEV2ZW50TGlzdGVuZXIiLCJyZW1vdmVFdmVudExpc3RlbmVyIiwibG9hZFByb2plY3QiLCJpbnN0cnVjdGlvbnMiLCJoYW5kbGVDcmVhdGUiLCJwcmV2ZW50RGVmYXVsdCIsInByb2plY3QiLCJoYW5kbGVDbG9zZUNyZWF0ZU1vZGFsIiwiaGFuZGxlRGVsZXRlIiwid2luZG93IiwiY29uZmlybSIsImhhbmRsZURlbGV0ZVByb2plY3QiLCJwIiwiaGFuZGxlU2F2ZUVkaXREZXRhaWxzIiwiaGFuZGxlU2F2ZUluc3RydWN0aW9ucyIsImhhbmRsZUZpbGVVcGxvYWQiLCJmaWxlcyIsImZpbGUiLCJBcnJheSIsImZyb20iLCJoYW5kbGVEZWxldGVGaWxlIiwiZmlsZUlkIiwiaGFuZGxlTmV3Q2hhdCIsImhhbmRsZURlbGV0ZUNvbnZlcnNhdGlvbiIsImNvbnZJZCIsInN0b3BQcm9wYWdhdGlvbiIsImhhbmRsZVJlbmFtZVNhdmUiLCJmaWx0ZXJlZFByb2plY3RzIiwiZmlsdGVyZWQiLCJ0b0xvd2VyQ2FzZSIsImluY2x1ZGVzIiwic29ydCIsImEiLCJiIiwiRGF0ZSIsImNyZWF0ZWRfYXQiLCJnZXRUaW1lIiwidXBkYXRlZF9hdCIsInZhbHVlIiwia2V5IiwiZm9udFdlaWdodCIsIm1hdGNoIiwibWluSGVpZ2h0IiwicG9zaXRpb24iLCJ0b3AiLCJsZWZ0IiwicmlnaHQiLCJwb2ludGVyRXZlbnRzIiwid2hpdGVTcGFjZSIsIndvcmRCcmVhayIsImJvcmRlclJhZGl1cyIsInN0eWxlIiwiaGVpZ2h0IiwiTWF0aCIsIm1pbiIsInNjcm9sbEhlaWdodCIsIm92ZXJmbG93WSIsInBvcyIsInNlbGVjdGlvblN0YXJ0IiwicHJlZml4Iiwic2x1ZyIsInN0YXJ0c1dpdGgiLCJzaGlmdEtleSIsInByZXYiLCJjbGljayIsInNraWxsIiwicmVwbGFjZSIsImZvY3VzIiwibG9jYXRpb24iLCJoYXNoIiwiY29udmVyc2F0aW9ucyIsInRpdGxlIiwidG9Mb2NhbGVEYXRlU3RyaW5nIiwiZm9udFNpemUiLCJmIiwiZmlsZV9uYW1lIiwiZmlsZV9zaXplIiwidG9GaXhlZCIsImRhdGFUcmFuc2ZlciIsImxhYmVsIiwib3B0IiwiZmlsZV9jb3VudCIsImNoYXRfY291bnQiLCJfYyJdLCJpZ25vcmVMaXN0IjpbXSwic291cmNlcyI6WyJQcm9qZWN0c1BhZ2UudHN4Il0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBSZWFjdCwgeyB1c2VTdGF0ZSwgdXNlRWZmZWN0LCB1c2VDYWxsYmFjaywgdXNlUmVmLCB1c2VNZW1vIH0gZnJvbSAncmVhY3QnO1xyXG5pbXBvcnQgeyBTZWFyY2gsIFBsdXMsIENoZXZyb25Eb3duLCBBcnJvd0xlZnQsIE1vcmVWZXJ0aWNhbCwgU3RhciwgQXJyb3dVcCwgRmlsZVRleHQsIFRyYXNoLCBQZW5jaWwsIE1lc3NhZ2VTcXVhcmUsIFgsIFVwbG9hZCwgQ2hlY2ssIEF1ZGlvTGluZXMsIENoZXZyb25SaWdodCwgQXJjaGl2ZSB9IGZyb20gJ2x1Y2lkZS1yZWFjdCc7XHJcbmltcG9ydCB7IHVzZU5hdmlnYXRlIH0gZnJvbSAncmVhY3Qtcm91dGVyLWRvbSc7XHJcbmltcG9ydCB7IFBhcGVyY2xpcCwgTGlzdENvbGxhcHNlIH0gZnJvbSAnbHVjaWRlLXJlYWN0JztcbmltcG9ydCB7IGdldFByb2plY3RzLCBjcmVhdGVQcm9qZWN0LCBnZXRQcm9qZWN0LCB1cGRhdGVQcm9qZWN0LCBkZWxldGVQcm9qZWN0LCB1cGxvYWRQcm9qZWN0RmlsZSwgZGVsZXRlUHJvamVjdEZpbGUsIGNyZWF0ZVByb2plY3RDb252ZXJzYXRpb24sIGRlbGV0ZUNvbnZlcnNhdGlvbiwgZ2V0U2tpbGxzLCBQcm9qZWN0LCBQcm9qZWN0RmlsZSB9IGZyb20gJy4uL2FwaSc7XG5pbXBvcnQgTW9kZWxTZWxlY3RvciwgeyBTZWxlY3RhYmxlTW9kZWwgfSBmcm9tICcuL01vZGVsU2VsZWN0b3InO1xuaW1wb3J0IHsgSWNvblBsdXMgfSBmcm9tICcuL0ljb25zJztcbmltcG9ydCBQcm9qZWN0Q3JlYXRlRm9ybSBmcm9tICcuL1Byb2plY3RDcmVhdGVGb3JtJztcbmltcG9ydCBzdGFydFByb2plY3RzSW1nIGZyb20gJy4uL2Fzc2V0cy9pY29ucy9zdGFydC1wcm9qZWN0cy5wbmcnO1xuXHJcbmNvbnN0IFByb2plY3RzUGFnZSA9ICgpID0+IHtcclxuICBjb25zdCBuYXZpZ2F0ZSA9IHVzZU5hdmlnYXRlKCk7XHJcbiAgY29uc3QgW3NlYXJjaFF1ZXJ5LCBzZXRTZWFyY2hRdWVyeV0gPSB1c2VTdGF0ZSgnJyk7XHJcbiAgY29uc3QgW2lzQ3JlYXRpbmcsIHNldElzQ3JlYXRpbmddID0gdXNlU3RhdGUoZmFsc2UpO1xuICBjb25zdCBbcHJvamVjdE5hbWUsIHNldFByb2plY3ROYW1lXSA9IHVzZVN0YXRlKCcnKTtcbiAgY29uc3QgW3Byb2plY3REZXNjcmlwdGlvbiwgc2V0UHJvamVjdERlc2NyaXB0aW9uXSA9IHVzZVN0YXRlKCcnKTtcbiAgY29uc3QgW3Byb2plY3ROYW1lRXJyb3IsIHNldFByb2plY3ROYW1lRXJyb3JdID0gdXNlU3RhdGU8c3RyaW5nIHwgbnVsbD4obnVsbCk7XG4gIGNvbnN0IFtwcm9qZWN0cywgc2V0UHJvamVjdHNdID0gdXNlU3RhdGU8UHJvamVjdFtdPihbXSk7XHJcbiAgY29uc3QgW2xvYWRpbmcsIHNldExvYWRpbmddID0gdXNlU3RhdGUodHJ1ZSk7XHJcbiAgY29uc3QgW2N1cnJlbnRQcm9qZWN0LCBzZXRDdXJyZW50UHJvamVjdF0gPSB1c2VTdGF0ZTxhbnk+KG51bGwpO1xyXG4gIGNvbnN0IFtlZGl0aW5nSW5zdHJ1Y3Rpb25zLCBzZXRFZGl0aW5nSW5zdHJ1Y3Rpb25zXSA9IHVzZVN0YXRlKGZhbHNlKTtcclxuICBjb25zdCBbaW5zdHJ1Y3Rpb25zVGV4dCwgc2V0SW5zdHJ1Y3Rpb25zVGV4dF0gPSB1c2VTdGF0ZSgnJyk7XHJcbiAgY29uc3QgW3VwbG9hZGluZywgc2V0VXBsb2FkaW5nXSA9IHVzZVN0YXRlKGZhbHNlKTtcclxuICBjb25zdCBbc2hvd01lbnUsIHNldFNob3dNZW51XSA9IHVzZVN0YXRlKGZhbHNlKTtcclxuICBjb25zdCBbZWRpdGluZ05hbWUsIHNldEVkaXRpbmdOYW1lXSA9IHVzZVN0YXRlKGZhbHNlKTtcclxuICBjb25zdCBbZWRpdE5hbWUsIHNldEVkaXROYW1lXSA9IHVzZVN0YXRlKCcnKTtcclxuICBjb25zdCBbc29ydE1lbnVPcGVuLCBzZXRTb3J0TWVudU9wZW5dID0gdXNlU3RhdGUoZmFsc2UpO1xyXG4gIGNvbnN0IFtzb3J0QnksIHNldFNvcnRCeV0gPSB1c2VTdGF0ZTwnYWN0aXZpdHknIHwgJ2VkaXRlZCcgfCAnY3JlYXRlZCc+KCdhY3Rpdml0eScpO1xyXG4gIGNvbnN0IFthY3RpdmVNZW51LCBzZXRBY3RpdmVNZW51XSA9IHVzZVN0YXRlPHN0cmluZyB8IG51bGw+KG51bGwpO1xyXG4gIGNvbnN0IFtwcm9qZWN0VG9EZWxldGUsIHNldFByb2plY3RUb0RlbGV0ZV0gPSB1c2VTdGF0ZTxQcm9qZWN0IHwgbnVsbD4obnVsbCk7XHJcbiAgY29uc3QgW3Byb2plY3RUb0VkaXQsIHNldFByb2plY3RUb0VkaXRdID0gdXNlU3RhdGU8UHJvamVjdCB8IG51bGw+KG51bGwpO1xyXG4gIGNvbnN0IFtlZGl0RGV0YWlsc05hbWUsIHNldEVkaXREZXRhaWxzTmFtZV0gPSB1c2VTdGF0ZSgnJyk7XHJcbiAgY29uc3QgW2VkaXREZXRhaWxzRGVzYywgc2V0RWRpdERldGFpbHNEZXNjXSA9IHVzZVN0YXRlKCcnKTtcclxuICBjb25zdCBbbWVzc2FnZSwgc2V0TWVzc2FnZV0gPSB1c2VTdGF0ZSgnJyk7XHJcbiAgY29uc3QgZmlsZUlucHV0UmVmID0gdXNlUmVmPEhUTUxJbnB1dEVsZW1lbnQ+KG51bGwpO1xyXG4gIGNvbnN0IHRleHRhcmVhUmVmID0gdXNlUmVmPEhUTUxUZXh0QXJlYUVsZW1lbnQ+KG51bGwpO1xyXG4gIGNvbnN0IFtzaG93UGx1c01lbnUsIHNldFNob3dQbHVzTWVudV0gPSB1c2VTdGF0ZShmYWxzZSk7XHJcbiAgY29uc3QgW3Nob3dTa2lsbHNTdWJtZW51LCBzZXRTaG93U2tpbGxzU3VibWVudV0gPSB1c2VTdGF0ZShmYWxzZSk7XHJcbiAgY29uc3QgW2VuYWJsZWRTa2lsbHMsIHNldEVuYWJsZWRTa2lsbHNdID0gdXNlU3RhdGU8QXJyYXk8eyBpZDogc3RyaW5nOyBuYW1lOiBzdHJpbmc7IGRlc2NyaXB0aW9uPzogc3RyaW5nIH0+PihbXSk7XHJcbiAgY29uc3QgW3NlbGVjdGVkU2tpbGwsIHNldFNlbGVjdGVkU2tpbGxdID0gdXNlU3RhdGU8eyBuYW1lOiBzdHJpbmc7IHNsdWc6IHN0cmluZzsgZGVzY3JpcHRpb24/OiBzdHJpbmcgfSB8IG51bGw+KG51bGwpO1xyXG4gIGNvbnN0IHBsdXNNZW51UmVmID0gdXNlUmVmPEhUTUxEaXZFbGVtZW50PihudWxsKTtcclxuICBjb25zdCBwbHVzQnRuUmVmID0gdXNlUmVmPEhUTUxCdXR0b25FbGVtZW50PihudWxsKTtcclxuXHJcbiAgLy8gTW9kZWwgc2VsZWN0b3Igc3RhdGUg4oCUIGxvYWQgZnJvbSBzZWxmLWhvc3RlZCBjb25maWcgb3IgdXNlIGRlZmF1bHRzXHJcbiAgY29uc3QgaXNTZWxmSG9zdGVkTW9kZSA9IGxvY2FsU3RvcmFnZS5nZXRJdGVtKCd1c2VyX21vZGUnKSA9PT0gJ3NlbGZob3N0ZWQnO1xyXG4gIGNvbnN0IHNlbGVjdG9yTW9kZWxzID0gdXNlTWVtbzxTZWxlY3RhYmxlTW9kZWxbXT4oKCkgPT4ge1xyXG4gICAgaWYgKGlzU2VsZkhvc3RlZE1vZGUpIHtcclxuICAgICAgdHJ5IHtcclxuICAgICAgICBjb25zdCBjaGF0TW9kZWxzID0gSlNPTi5wYXJzZShsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnY2hhdF9tb2RlbHMnKSB8fCAnW10nKTtcclxuICAgICAgICBpZiAoY2hhdE1vZGVscy5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgICBjb25zdCB0aWVyRGVzY01hcDogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHtcclxuICAgICAgICAgICAgJ29wdXMnOiAnTW9zdCBjYXBhYmxlIGZvciBhbWJpdGlvdXMgd29yaycsXHJcbiAgICAgICAgICAgICdzb25uZXQnOiAnTW9zdCBlZmZpY2llbnQgZm9yIGV2ZXJ5ZGF5IHRhc2tzJyxcclxuICAgICAgICAgICAgJ2hhaWt1JzogJ0Zhc3Rlc3QgZm9yIHF1aWNrIGFuc3dlcnMnLFxyXG4gICAgICAgICAgfTtcclxuICAgICAgICAgIHJldHVybiBjaGF0TW9kZWxzLm1hcCgobTogYW55KSA9PiAoe1xyXG4gICAgICAgICAgICBpZDogbS5pZCxcclxuICAgICAgICAgICAgbmFtZTogbS5uYW1lIHx8IG0uaWQsXHJcbiAgICAgICAgICAgIGVuYWJsZWQ6IDEsXHJcbiAgICAgICAgICAgIHRpZXI6IG0udGllciB8fCAnZXh0cmEnLFxyXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogbS50aWVyICYmIHRpZXJEZXNjTWFwW20udGllcl0gPyB0aWVyRGVzY01hcFttLnRpZXJdIDogdW5kZWZpbmVkLFxyXG4gICAgICAgICAgfSkpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSBjYXRjaCAoXykgeyB9XHJcbiAgICB9XHJcbiAgICByZXR1cm4gW1xyXG4gICAgICB7IGlkOiAnY2xhdWRlLW9wdXMtNC02JywgbmFtZTogJ09wdXMgNC42JywgZW5hYmxlZDogMSwgZGVzY3JpcHRpb246ICdNb3N0IGNhcGFibGUgZm9yIGFtYml0aW91cyB3b3JrJyB9LFxyXG4gICAgICB7IGlkOiAnY2xhdWRlLXNvbm5ldC00LTYnLCBuYW1lOiAnU29ubmV0IDQuNicsIGVuYWJsZWQ6IDEsIGRlc2NyaXB0aW9uOiAnTW9zdCBlZmZpY2llbnQgZm9yIGV2ZXJ5ZGF5IHRhc2tzJyB9LFxyXG4gICAgICB7IGlkOiAnY2xhdWRlLWhhaWt1LTQtNS0yMDI1MTAwMScsIG5hbWU6ICdIYWlrdSA0LjUnLCBlbmFibGVkOiAxLCBkZXNjcmlwdGlvbjogJ0Zhc3Rlc3QgZm9yIHF1aWNrIGFuc3dlcnMnIH0sXHJcbiAgICBdO1xyXG4gIH0sIFtpc1NlbGZIb3N0ZWRNb2RlXSk7XHJcbiAgY29uc3QgW2N1cnJlbnRNb2RlbFN0cmluZywgc2V0Q3VycmVudE1vZGVsU3RyaW5nXSA9IHVzZVN0YXRlKGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdkZWZhdWx0X21vZGVsJykgfHwgJ2NsYXVkZS1zb25uZXQtNC02Jyk7XHJcbiAgY29uc3QgaGFuZGxlTW9kZWxDaGFuZ2UgPSAobmV3TW9kZWxTdHJpbmc6IHN0cmluZykgPT4ge1xyXG4gICAgc2V0Q3VycmVudE1vZGVsU3RyaW5nKG5ld01vZGVsU3RyaW5nKTtcclxuICB9O1xyXG5cclxuICBjb25zdCBoYW5kbGVDaGF0U3VibWl0ID0gYXN5bmMgKCkgPT4ge1xyXG4gICAgaWYgKCFtZXNzYWdlLnRyaW0oKSB8fCAhY3VycmVudFByb2plY3QpIHJldHVybjtcclxuICAgIHRyeSB7XHJcbiAgICAgIGNvbnN0IGNvbnYgPSBhd2FpdCBjcmVhdGVQcm9qZWN0Q29udmVyc2F0aW9uKGN1cnJlbnRQcm9qZWN0LmlkLCBtZXNzYWdlLnNsaWNlKDAsIDUwKSwgY3VycmVudE1vZGVsU3RyaW5nKTtcclxuICAgICAgbmF2aWdhdGUoYC9jaGF0LyR7Y29udi5pZH1gLCB7IHN0YXRlOiB7IGluaXRpYWxNZXNzYWdlOiBtZXNzYWdlLCBtb2RlbDogY3VycmVudE1vZGVsU3RyaW5nIH0gfSk7XHJcbiAgICAgIHNldE1lc3NhZ2UoJycpO1xyXG4gICAgfSBjYXRjaCAoZXJyKSB7XHJcbiAgICAgIGNvbnNvbGUuZXJyb3IoZXJyKTtcclxuICAgIH1cclxuICB9O1xyXG5cclxuICBjb25zdCBsb2FkUHJvamVjdHMgPSB1c2VDYWxsYmFjayhhc3luYyAoKSA9PiB7XHJcbiAgICB0cnkge1xyXG4gICAgICBjb25zdCBkYXRhID0gYXdhaXQgZ2V0UHJvamVjdHMoKTtcclxuICAgICAgc2V0UHJvamVjdHMoZGF0YSk7XHJcbiAgICB9IGNhdGNoIChfKSB7IH1cclxuICAgIHNldExvYWRpbmcoZmFsc2UpO1xyXG4gIH0sIFtdKTtcclxuXHJcbiAgdXNlRWZmZWN0KCgpID0+IHsgbG9hZFByb2plY3RzKCk7IH0sIFtsb2FkUHJvamVjdHNdKTtcclxuXHJcbiAgLy8gTG9hZCBza2lsbHMgd2hlbiBwbHVzIG1lbnUgb3BlbnNcclxuICB1c2VFZmZlY3QoKCkgPT4ge1xyXG4gICAgaWYgKCFzaG93UGx1c01lbnUpIHsgc2V0U2hvd1NraWxsc1N1Ym1lbnUoZmFsc2UpOyByZXR1cm47IH1cclxuICAgIGdldFNraWxscygpLnRoZW4oKGRhdGE6IGFueSkgPT4ge1xyXG4gICAgICBjb25zdCBhbGwgPSBbLi4uKGRhdGEuZXhhbXBsZXMgfHwgW10pLCAuLi4oZGF0YS5teV9za2lsbHMgfHwgW10pXTtcclxuICAgICAgc2V0RW5hYmxlZFNraWxscyhhbGwuZmlsdGVyKChzOiBhbnkpID0+IHMuZW5hYmxlZCkubWFwKChzOiBhbnkpID0+ICh7IGlkOiBzLmlkLCBuYW1lOiBzLm5hbWUsIGRlc2NyaXB0aW9uOiBzLmRlc2NyaXB0aW9uIH0pKSk7XHJcbiAgICB9KS5jYXRjaCgoKSA9PiB7fSk7XHJcbiAgfSwgW3Nob3dQbHVzTWVudV0pO1xyXG5cclxuICAvLyBDbG9zZSBwbHVzIG1lbnUgb24gb3V0c2lkZSBjbGlja1xyXG4gIHVzZUVmZmVjdCgoKSA9PiB7XHJcbiAgICBpZiAoIXNob3dQbHVzTWVudSkgcmV0dXJuO1xyXG4gICAgY29uc3QgaGFuZGxlQ2xpY2sgPSAoZTogTW91c2VFdmVudCkgPT4ge1xyXG4gICAgICBpZiAocGx1c01lbnVSZWYuY3VycmVudCAmJiAhcGx1c01lbnVSZWYuY3VycmVudC5jb250YWlucyhlLnRhcmdldCBhcyBOb2RlKSAmJlxyXG4gICAgICAgIHBsdXNCdG5SZWYuY3VycmVudCAmJiAhcGx1c0J0blJlZi5jdXJyZW50LmNvbnRhaW5zKGUudGFyZ2V0IGFzIE5vZGUpKSB7XHJcbiAgICAgICAgc2V0U2hvd1BsdXNNZW51KGZhbHNlKTtcclxuICAgICAgfVxyXG4gICAgfTtcclxuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlZG93bicsIGhhbmRsZUNsaWNrKTtcclxuICAgIHJldHVybiAoKSA9PiBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdtb3VzZWRvd24nLCBoYW5kbGVDbGljayk7XHJcbiAgfSwgW3Nob3dQbHVzTWVudV0pO1xyXG5cclxuICBjb25zdCBsb2FkUHJvamVjdCA9IHVzZUNhbGxiYWNrKGFzeW5jIChpZDogc3RyaW5nKSA9PiB7XHJcbiAgICB0cnkge1xyXG4gICAgICBjb25zdCBkYXRhID0gYXdhaXQgZ2V0UHJvamVjdChpZCk7XHJcbiAgICAgIHNldEN1cnJlbnRQcm9qZWN0KGRhdGEpO1xyXG4gICAgICBzZXRJbnN0cnVjdGlvbnNUZXh0KGRhdGEuaW5zdHJ1Y3Rpb25zIHx8ICcnKTtcclxuICAgIH0gY2F0Y2ggKF8pIHsgfVxyXG4gIH0sIFtdKTtcclxuXHJcbiAgY29uc3QgaGFuZGxlQ3JlYXRlID0gYXN5bmMgKGU/OiBSZWFjdC5Gb3JtRXZlbnQpID0+IHtcbiAgICBlPy5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIGNvbnN0IG5hbWUgPSBwcm9qZWN0TmFtZS50cmltKCk7XG4gICAgaWYgKCFuYW1lKSB7XG4gICAgICBzZXRQcm9qZWN0TmFtZUVycm9yKCdQcm9qZWN0IG5hbWUgaXMgcmVxdWlyZWQnKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHByb2plY3QgPSBhd2FpdCBjcmVhdGVQcm9qZWN0KG5hbWUsIHByb2plY3REZXNjcmlwdGlvbi50cmltKCkpO1xuICAgICAgc2V0SXNDcmVhdGluZyhmYWxzZSk7XG4gICAgICBzZXRQcm9qZWN0TmFtZSgnJyk7XG4gICAgICBzZXRQcm9qZWN0RGVzY3JpcHRpb24oJycpO1xuICAgICAgc2V0UHJvamVjdE5hbWVFcnJvcihudWxsKTtcbiAgICAgIGxvYWRQcm9qZWN0KHByb2plY3QuaWQpO1xuICAgICAgbG9hZFByb2plY3RzKCk7XG4gICAgfSBjYXRjaCAoXykgeyB9XG4gIH07XG5cbiAgY29uc3QgaGFuZGxlQ2xvc2VDcmVhdGVNb2RhbCA9ICgpID0+IHtcbiAgICBzZXRJc0NyZWF0aW5nKGZhbHNlKTtcbiAgICBzZXRQcm9qZWN0TmFtZSgnJyk7XG4gICAgc2V0UHJvamVjdERlc2NyaXB0aW9uKCcnKTtcbiAgICBzZXRQcm9qZWN0TmFtZUVycm9yKG51bGwpO1xuICB9O1xuXHJcbiAgY29uc3QgaGFuZGxlRGVsZXRlID0gYXN5bmMgKCkgPT4ge1xyXG4gICAgaWYgKCFjdXJyZW50UHJvamVjdCkgcmV0dXJuO1xyXG4gICAgaWYgKCF3aW5kb3cuY29uZmlybShg56Gu5a6a6KaB5Yig6Zmk6aG555uu44CMJHtjdXJyZW50UHJvamVjdC5uYW1lfeOAjeWQl++8n+aJgOacieWFs+iBlOeahOaWh+S7tuWSjOWvueivneS5n+S8muiiq+WIoOmZpOOAgmApKSByZXR1cm47XHJcbiAgICB0cnkge1xyXG4gICAgICBhd2FpdCBkZWxldGVQcm9qZWN0KGN1cnJlbnRQcm9qZWN0LmlkKTtcclxuICAgICAgc2V0Q3VycmVudFByb2plY3QobnVsbCk7XHJcbiAgICAgIHNldFNob3dNZW51KGZhbHNlKTtcclxuICAgICAgbG9hZFByb2plY3RzKCk7XHJcbiAgICB9IGNhdGNoIChfKSB7IH1cclxuICB9O1xyXG5cclxuICBjb25zdCBoYW5kbGVEZWxldGVQcm9qZWN0ID0gYXN5bmMgKHA6IFByb2plY3QpID0+IHtcclxuICAgIHRyeSB7XHJcbiAgICAgIGF3YWl0IGRlbGV0ZVByb2plY3QocC5pZCk7XHJcbiAgICAgIGlmIChjdXJyZW50UHJvamVjdCAmJiBjdXJyZW50UHJvamVjdC5pZCA9PT0gcC5pZCkge1xyXG4gICAgICAgIHNldEN1cnJlbnRQcm9qZWN0KG51bGwpO1xyXG4gICAgICB9XHJcbiAgICAgIHNldFByb2plY3RUb0RlbGV0ZShudWxsKTtcclxuICAgICAgbG9hZFByb2plY3RzKCk7XHJcbiAgICB9IGNhdGNoIChfKSB7IH1cclxuICB9O1xyXG5cclxuICBjb25zdCBoYW5kbGVTYXZlRWRpdERldGFpbHMgPSBhc3luYyAoKSA9PiB7XHJcbiAgICBpZiAoIXByb2plY3RUb0VkaXQpIHJldHVybjtcclxuICAgIHRyeSB7XHJcbiAgICAgIGF3YWl0IHVwZGF0ZVByb2plY3QocHJvamVjdFRvRWRpdC5pZCwge1xyXG4gICAgICAgIG5hbWU6IGVkaXREZXRhaWxzTmFtZSxcclxuICAgICAgICBkZXNjcmlwdGlvbjogZWRpdERldGFpbHNEZXNjXHJcbiAgICAgIH0pO1xyXG4gICAgICBzZXRQcm9qZWN0VG9FZGl0KG51bGwpO1xyXG4gICAgICBsb2FkUHJvamVjdHMoKTtcclxuICAgICAgaWYgKGN1cnJlbnRQcm9qZWN0ICYmIGN1cnJlbnRQcm9qZWN0LmlkID09PSBwcm9qZWN0VG9FZGl0LmlkKSB7XHJcbiAgICAgICAgbG9hZFByb2plY3QoY3VycmVudFByb2plY3QuaWQpO1xyXG4gICAgICB9XHJcbiAgICB9IGNhdGNoIChfKSB7IH1cclxuICB9O1xyXG5cclxuICBjb25zdCBoYW5kbGVTYXZlSW5zdHJ1Y3Rpb25zID0gYXN5bmMgKCkgPT4ge1xyXG4gICAgaWYgKCFjdXJyZW50UHJvamVjdCkgcmV0dXJuO1xyXG4gICAgYXdhaXQgdXBkYXRlUHJvamVjdChjdXJyZW50UHJvamVjdC5pZCwgeyBpbnN0cnVjdGlvbnM6IGluc3RydWN0aW9uc1RleHQgfSk7XHJcbiAgICBzZXRFZGl0aW5nSW5zdHJ1Y3Rpb25zKGZhbHNlKTtcclxuICAgIGxvYWRQcm9qZWN0KGN1cnJlbnRQcm9qZWN0LmlkKTtcclxuICB9O1xyXG5cclxuICBjb25zdCBoYW5kbGVGaWxlVXBsb2FkID0gYXN5bmMgKGZpbGVzOiBGaWxlTGlzdCB8IEZpbGVbXSkgPT4ge1xyXG4gICAgaWYgKCFjdXJyZW50UHJvamVjdCkgcmV0dXJuO1xyXG4gICAgc2V0VXBsb2FkaW5nKHRydWUpO1xyXG4gICAgZm9yIChjb25zdCBmaWxlIG9mIEFycmF5LmZyb20oZmlsZXMpKSB7XHJcbiAgICAgIHRyeSB7XHJcbiAgICAgICAgYXdhaXQgdXBsb2FkUHJvamVjdEZpbGUoY3VycmVudFByb2plY3QuaWQsIGZpbGUpO1xyXG4gICAgICB9IGNhdGNoIChfKSB7IH1cclxuICAgIH1cclxuICAgIHNldFVwbG9hZGluZyhmYWxzZSk7XHJcbiAgICBsb2FkUHJvamVjdChjdXJyZW50UHJvamVjdC5pZCk7XHJcbiAgfTtcclxuXHJcbiAgY29uc3QgaGFuZGxlRGVsZXRlRmlsZSA9IGFzeW5jIChmaWxlSWQ6IHN0cmluZykgPT4ge1xyXG4gICAgaWYgKCFjdXJyZW50UHJvamVjdCkgcmV0dXJuO1xyXG4gICAgYXdhaXQgZGVsZXRlUHJvamVjdEZpbGUoY3VycmVudFByb2plY3QuaWQsIGZpbGVJZCk7XHJcbiAgICBsb2FkUHJvamVjdChjdXJyZW50UHJvamVjdC5pZCk7XHJcbiAgfTtcclxuXHJcbiAgY29uc3QgaGFuZGxlTmV3Q2hhdCA9IGFzeW5jICgpID0+IHtcclxuICAgIGlmICghY3VycmVudFByb2plY3QpIHJldHVybjtcclxuICAgIHRyeSB7XHJcbiAgICAgIGNvbnN0IGNvbnYgPSBhd2FpdCBjcmVhdGVQcm9qZWN0Q29udmVyc2F0aW9uKGN1cnJlbnRQcm9qZWN0LmlkKTtcclxuICAgICAgbmF2aWdhdGUoYC9jaGF0LyR7Y29udi5pZH1gKTtcclxuICAgIH0gY2F0Y2ggKF8pIHsgfVxyXG4gIH07XHJcblxyXG4gIGNvbnN0IGhhbmRsZURlbGV0ZUNvbnZlcnNhdGlvbiA9IGFzeW5jIChjb252SWQ6IHN0cmluZywgZTogUmVhY3QuTW91c2VFdmVudCkgPT4ge1xyXG4gICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcclxuICAgIGlmICghY3VycmVudFByb2plY3QpIHJldHVybjtcclxuICAgIHRyeSB7XHJcbiAgICAgIGF3YWl0IGRlbGV0ZUNvbnZlcnNhdGlvbihjb252SWQpO1xyXG4gICAgICBsb2FkUHJvamVjdChjdXJyZW50UHJvamVjdC5pZCk7XHJcbiAgICAgIGxvYWRQcm9qZWN0cygpOyAvLyByZWZyZXNoIGNoYXRfY291bnRcclxuICAgIH0gY2F0Y2ggKF8pIHsgfVxyXG4gIH07XHJcblxyXG4gIGNvbnN0IGhhbmRsZVJlbmFtZVNhdmUgPSBhc3luYyAoKSA9PiB7XHJcbiAgICBpZiAoIWN1cnJlbnRQcm9qZWN0IHx8ICFlZGl0TmFtZS50cmltKCkpIHJldHVybjtcclxuICAgIGF3YWl0IHVwZGF0ZVByb2plY3QoY3VycmVudFByb2plY3QuaWQsIHsgbmFtZTogZWRpdE5hbWUudHJpbSgpIH0pO1xyXG4gICAgc2V0RWRpdGluZ05hbWUoZmFsc2UpO1xyXG4gICAgbG9hZFByb2plY3QoY3VycmVudFByb2plY3QuaWQpO1xyXG4gICAgbG9hZFByb2plY3RzKCk7XHJcbiAgfTtcclxuXHJcbiAgY29uc3QgZmlsdGVyZWRQcm9qZWN0cyA9IHVzZU1lbW8oKCkgPT4ge1xyXG4gICAgY29uc3QgZmlsdGVyZWQgPSBwcm9qZWN0cy5maWx0ZXIocCA9PlxyXG4gICAgICBwLm5hbWUudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyhzZWFyY2hRdWVyeS50b0xvd2VyQ2FzZSgpKSB8fFxyXG4gICAgICBwLmRlc2NyaXB0aW9uLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoc2VhcmNoUXVlcnkudG9Mb3dlckNhc2UoKSlcclxuICAgICk7XHJcbiAgICByZXR1cm4gWy4uLmZpbHRlcmVkXS5zb3J0KChhLCBiKSA9PiB7XHJcbiAgICAgIGlmIChzb3J0QnkgPT09ICdjcmVhdGVkJykgcmV0dXJuIG5ldyBEYXRlKGIuY3JlYXRlZF9hdCkuZ2V0VGltZSgpIC0gbmV3IERhdGUoYS5jcmVhdGVkX2F0KS5nZXRUaW1lKCk7XHJcbiAgICAgIC8vICdhY3Rpdml0eScgYW5kICdlZGl0ZWQnIGJvdGggc29ydCBieSB1cGRhdGVkX2F0XHJcbiAgICAgIHJldHVybiBuZXcgRGF0ZShiLnVwZGF0ZWRfYXQpLmdldFRpbWUoKSAtIG5ldyBEYXRlKGEudXBkYXRlZF9hdCkuZ2V0VGltZSgpO1xyXG4gICAgfSk7XHJcbiAgfSwgW3Byb2plY3RzLCBzZWFyY2hRdWVyeSwgc29ydEJ5XSk7XHJcblxyXG4gIC8vIOKVkOKVkOKVkCBQcm9qZWN0IERldGFpbCBWaWV3IOKVkOKVkOKVkFxyXG4gIGlmIChjdXJyZW50UHJvamVjdCkge1xyXG4gICAgcmV0dXJuIChcclxuICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4LTEgaC1mdWxsIGJnLWNsYXVkZS1iZyBvdmVyZmxvdy15LWF1dG9cIj5cclxuICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cIm1heC13LVs4MDBweF0gbXgtYXV0byBweC04IHB5LTEyXCI+XHJcbiAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cIm1iLTRcIj5cclxuICAgICAgICAgICAgPGJ1dHRvblxyXG4gICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHsgc2V0Q3VycmVudFByb2plY3QobnVsbCk7IGxvYWRQcm9qZWN0cygpOyB9fVxyXG4gICAgICAgICAgICAgIGNsYXNzTmFtZT1cImZsZXggaXRlbXMtY2VudGVyIGdhcC0xLjUgdGV4dC1bMTRweF0gdGV4dC1jbGF1ZGUtdGV4dFNlY29uZGFyeSBob3Zlcjp0ZXh0LWNsYXVkZS10ZXh0IHRyYW5zaXRpb24tY29sb3JzIGZvbnQtbWVkaXVtIC1tbC0xXCJcclxuICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgIDxBcnJvd0xlZnQgc2l6ZT17MTZ9IC8+XHJcbiAgICAgICAgICAgICAgQWxsIHByb2plY3RzXHJcbiAgICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGl0ZW1zLXN0YXJ0IGp1c3RpZnktYmV0d2VlbiBtYi04IGdhcC00XCI+XHJcbiAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleC0xIG1pbi13LTBcIj5cclxuICAgICAgICAgICAgICB7ZWRpdGluZ05hbWUgPyAoXHJcbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggaXRlbXMtY2VudGVyIGdhcC0yXCI+XHJcbiAgICAgICAgICAgICAgICAgIDxpbnB1dFxyXG4gICAgICAgICAgICAgICAgICAgIGF1dG9Gb2N1c1xyXG4gICAgICAgICAgICAgICAgICAgIHZhbHVlPXtlZGl0TmFtZX1cclxuICAgICAgICAgICAgICAgICAgICBvbkNoYW5nZT17ZSA9PiBzZXRFZGl0TmFtZShlLnRhcmdldC52YWx1ZSl9XHJcbiAgICAgICAgICAgICAgICAgICAgb25LZXlEb3duPXtlID0+IHsgaWYgKGUua2V5ID09PSAnRW50ZXInKSBoYW5kbGVSZW5hbWVTYXZlKCk7IGlmIChlLmtleSA9PT0gJ0VzY2FwZScpIHNldEVkaXRpbmdOYW1lKGZhbHNlKTsgfX1cclxuICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJmb250LVtTcGVjdHJhbF0gdGV4dC1bMzJweF0gdGV4dC1jbGF1ZGUtdGV4dCBiZy10cmFuc3BhcmVudCBib3JkZXItYi0yIGJvcmRlci1jbGF1ZGUtYWNjZW50IG91dGxpbmUtbm9uZSB3LWZ1bGxcIlxyXG4gICAgICAgICAgICAgICAgICAgIHN0eWxlPXt7IGZvbnRXZWlnaHQ6IDUwMCB9fVxyXG4gICAgICAgICAgICAgICAgICAvPlxyXG4gICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgKSA6IChcclxuICAgICAgICAgICAgICAgIDxoMVxyXG4gICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJmb250LVtTcGVjdHJhbF0gdGV4dC1bMzJweF0gdGV4dC1jbGF1ZGUtdGV4dCBsZWFkaW5nLXRpZ2h0IG1iLTJcIlxyXG4gICAgICAgICAgICAgICAgICBzdHlsZT17eyBmb250V2VpZ2h0OiA1MDAgfX1cclxuICAgICAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICAgICAge2N1cnJlbnRQcm9qZWN0Lm5hbWV9XHJcbiAgICAgICAgICAgICAgICA8L2gxPlxyXG4gICAgICAgICAgICAgICl9XHJcbiAgICAgICAgICAgICAge2N1cnJlbnRQcm9qZWN0LmRlc2NyaXB0aW9uICYmIChcclxuICAgICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQtWzE1LjVweF0gdGV4dC1jbGF1ZGUtdGV4dFNlY29uZGFyeVwiPntjdXJyZW50UHJvamVjdC5kZXNjcmlwdGlvbn08L3A+XHJcbiAgICAgICAgICAgICAgKX1cclxuICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTEgdGV4dC1jbGF1ZGUtdGV4dFNlY29uZGFyeSBtdC0yIGZsZXgtc2hyaW5rLTBcIj5cclxuICAgICAgICAgICAgICA8YnV0dG9uIGNsYXNzTmFtZT1cInAtMSBob3Zlcjp0ZXh0LWNsYXVkZS10ZXh0IGhvdmVyOmJnLWJsYWNrLzUgZGFyazpob3ZlcjpiZy13aGl0ZS81IHJvdW5kZWQtbWQgdHJhbnNpdGlvbi1jb2xvcnNcIj48TW9yZVZlcnRpY2FsIHNpemU9ezE4fSAvPjwvYnV0dG9uPlxyXG4gICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwic3BhY2UteS00XCI+XHJcbiAgICAgICAgICAgIHsvKiBDaGF0IElucHV0IENvbnRhaW5lciDigJQgbWF0Y2hlcyBNYWluQ29udGVudCBuZXcgY2hhdCBpbnB1dCAqL31cclxuICAgICAgICAgICAgPGRpdlxyXG4gICAgICAgICAgICAgIGNsYXNzTmFtZT1cImJnLWNsYXVkZS1pbnB1dCBib3JkZXIgYm9yZGVyLWNsYXVkZS1ib3JkZXIgZGFyazpib3JkZXItWyMzYTNhMzhdIHNoYWRvdy1bMF8ycHhfOHB4X3JnYmEoMCwwLDAsMC4wMildIGhvdmVyOnNoYWRvdy1bMF8ycHhfOHB4X3JnYmEoMCwwLDAsMC4wOCldIGhvdmVyOmJvcmRlci1bI0NDQ10gZGFyazpob3Zlcjpib3JkZXItWyM1YTVhNThdIGZvY3VzLXdpdGhpbjpzaGFkb3ctWzBfMnB4XzhweF9yZ2JhKDAsMCwwLDAuMDgpXSBmb2N1cy13aXRoaW46Ym9yZGVyLVsjQ0NDXSBkYXJrOmZvY3VzLXdpdGhpbjpib3JkZXItWyM1YTVhNThdIHRyYW5zaXRpb24tYWxsIGR1cmF0aW9uLTIwMCBmbGV4IGZsZXgtY29sIG1heC1oLVs2MHZoXSBmb250LXNhbnMgcm91bmRlZC0yeGxcIlxyXG4gICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4LTEgb3ZlcmZsb3cteS1hdXRvIG1pbi1oLTBcIj5cclxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwicmVsYXRpdmVcIj5cclxuICAgICAgICAgICAgICAgICAgey8qIFNraWxsIG92ZXJsYXkgKi99XHJcbiAgICAgICAgICAgICAgICAgIHttZXNzYWdlLm1hdGNoKC9eXFwvW2EtekEtWjAtOV8tXSsvKSAmJiAoXHJcbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJwbC01IHByLTQgcHQtNSBwYi0xIHRleHQtWzE2cHhdIGZvbnQtc2FucyBmb250LVszNTBdXCIgc3R5bGU9e3sgbWluSGVpZ2h0OiAnNDhweCcsIHBvc2l0aW9uOiAnYWJzb2x1dGUnLCB0b3A6IDAsIGxlZnQ6IDAsIHJpZ2h0OiAwLCBwb2ludGVyRXZlbnRzOiAnbm9uZScsIHdoaXRlU3BhY2U6ICdwcmUtd3JhcCcsIHdvcmRCcmVhazogJ2JyZWFrLXdvcmQnIH19IGFyaWEtaGlkZGVuPlxyXG4gICAgICAgICAgICAgICAgICAgICAgeygoKSA9PiB7IGNvbnN0IG0gPSBtZXNzYWdlLm1hdGNoKC9eKFxcL1thLXpBLVowLTlfLV0rKShbXFxzXFxTXSopJC8pOyByZXR1cm4gbSA/IDw+PHNwYW4gY2xhc3NOYW1lPVwidGV4dC1bIzRCOUVGQV1cIj57bVsxXX08L3NwYW4+PHNwYW4gY2xhc3NOYW1lPVwidGV4dC1jbGF1ZGUtdGV4dFwiPnttWzJdfTwvc3Bhbj48Lz4gOiBudWxsOyB9KSgpfVxyXG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICApfVxyXG4gICAgICAgICAgICAgICAgICA8dGV4dGFyZWFcclxuICAgICAgICAgICAgICAgICAgICByZWY9e3RleHRhcmVhUmVmfVxyXG4gICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT17YHctZnVsbCBwbC01IHByLTQgcHQtNSBwYi0xIHBsYWNlaG9sZGVyOnRleHQtY2xhdWRlLXRleHRTZWNvbmRhcnkgdGV4dC1bMTZweF0gb3V0bGluZS1ub25lIHJlc2l6ZS1ub25lIG92ZXJmbG93LWhpZGRlbiBiZy10cmFuc3BhcmVudCBmb250LXNhbnMgZm9udC1bMzUwXSAke21lc3NhZ2UubWF0Y2goL15cXC9bYS16QS1aMC05Xy1dKy8pID8gJ3RleHQtdHJhbnNwYXJlbnQgY2FyZXQtY2xhdWRlLXRleHQnIDogJ3RleHQtY2xhdWRlLXRleHQnfWB9XHJcbiAgICAgICAgICAgICAgICAgICAgc3R5bGU9e3sgbWluSGVpZ2h0OiAnNDhweCcsIGJvcmRlclJhZGl1czogJzE2cHggMTZweCAwIDAnIH19XHJcbiAgICAgICAgICAgICAgICAgICAgcGxhY2Vob2xkZXI9e3NlbGVjdGVkU2tpbGwgPyBgRGVzY3JpYmUgd2hhdCB5b3Ugd2FudCAke3NlbGVjdGVkU2tpbGwubmFtZX0gdG8gZG8uLi5gIDogXCJIb3cgY2FuIEkgaGVscCB5b3UgdG9kYXk/XCJ9XHJcbiAgICAgICAgICAgICAgICAgICAgdmFsdWU9e21lc3NhZ2V9XHJcbiAgICAgICAgICAgICAgICAgICAgb25DaGFuZ2U9eyhlKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICBzZXRNZXNzYWdlKGUudGFyZ2V0LnZhbHVlKTtcclxuICAgICAgICAgICAgICAgICAgICAgIGUudGFyZ2V0LnN0eWxlLmhlaWdodCA9ICdhdXRvJztcclxuICAgICAgICAgICAgICAgICAgICAgIGUudGFyZ2V0LnN0eWxlLmhlaWdodCA9IE1hdGgubWluKGUudGFyZ2V0LnNjcm9sbEhlaWdodCwgMzAwKSArICdweCc7XHJcbiAgICAgICAgICAgICAgICAgICAgICBlLnRhcmdldC5zdHlsZS5vdmVyZmxvd1kgPSBlLnRhcmdldC5zY3JvbGxIZWlnaHQgPiAzMDAgPyAnYXV0bycgOiAnaGlkZGVuJztcclxuICAgICAgICAgICAgICAgICAgICB9fVxyXG4gICAgICAgICAgICAgICAgICAgIG9uS2V5RG93bj17ZSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICBpZiAoZS5rZXkgPT09ICdCYWNrc3BhY2UnICYmIHNlbGVjdGVkU2tpbGwpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcG9zID0gKGUudGFyZ2V0IGFzIEhUTUxUZXh0QXJlYUVsZW1lbnQpLnNlbGVjdGlvblN0YXJ0O1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBwcmVmaXggPSBgLyR7c2VsZWN0ZWRTa2lsbC5zbHVnfSBgO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAocG9zID4gMCAmJiBwb3MgPD0gcHJlZml4Lmxlbmd0aCAmJiBtZXNzYWdlLnN0YXJ0c1dpdGgocHJlZml4LnNsaWNlKDAsIHBvcykpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHNldE1lc3NhZ2UobWVzc2FnZS5zbGljZShwcmVmaXgubGVuZ3RoKSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgc2V0U2VsZWN0ZWRTa2lsbChudWxsKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgIGlmIChlLmtleSA9PT0gJ0VudGVyJyAmJiAhZS5zaGlmdEtleSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGhhbmRsZUNoYXRTdWJtaXQoKTtcclxuICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICB9fVxyXG4gICAgICAgICAgICAgICAgICAvPlxyXG4gICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJweC00IHBiLTMgcHQtMSBmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWJldHdlZW4gZmxleC1zaHJpbmstMFwiPlxyXG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJyZWxhdGl2ZSBmbGV4IGl0ZW1zLWNlbnRlclwiPlxyXG4gICAgICAgICAgICAgICAgICA8YnV0dG9uXHJcbiAgICAgICAgICAgICAgICAgICAgcmVmPXtwbHVzQnRuUmVmfVxyXG4gICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHNldFNob3dQbHVzTWVudShwcmV2ID0+ICFwcmV2KX1cclxuICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJwLTIgdGV4dC1jbGF1ZGUtdGV4dFNlY29uZGFyeSBob3Zlcjp0ZXh0LWNsYXVkZS10ZXh0IGhvdmVyOmJnLWNsYXVkZS1ob3ZlciByb3VuZGVkLWxnIHRyYW5zaXRpb24tY29sb3JzXCJcclxuICAgICAgICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgICAgICAgIDxJY29uUGx1cyBzaXplPXsyMH0gLz5cclxuICAgICAgICAgICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgICAgICAgICAgIHtzaG93UGx1c01lbnUgJiYgKFxyXG4gICAgICAgICAgICAgICAgICAgIDxkaXYgcmVmPXtwbHVzTWVudVJlZn0gY2xhc3NOYW1lPVwiYWJzb2x1dGUgYm90dG9tLWZ1bGwgbGVmdC0wIG1iLTIgdy1bMjIwcHhdIGJnLWNsYXVkZS1pbnB1dCBib3JkZXIgYm9yZGVyLWNsYXVkZS1ib3JkZXIgcm91bmRlZC14bCBzaGFkb3ctWzBfNHB4XzE2cHhfcmdiYSgwLDAsMCwwLjEyKV0gcHktMS41IHotNTBcIj5cclxuICAgICAgICAgICAgICAgICAgICAgIDxidXR0b24gb25DbGljaz17KCkgPT4geyBzZXRTaG93UGx1c01lbnUoZmFsc2UpOyBmaWxlSW5wdXRSZWYuY3VycmVudD8uY2xpY2soKTsgfX0gY2xhc3NOYW1lPVwidy1mdWxsIGZsZXggaXRlbXMtY2VudGVyIGdhcC0zIHB4LTQgcHktMi41IHRleHQtWzEzcHhdIHRleHQtY2xhdWRlLXRleHQgaG92ZXI6YmctY2xhdWRlLWhvdmVyIHRyYW5zaXRpb24tY29sb3JzXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxQYXBlcmNsaXAgc2l6ZT17MTZ9IGNsYXNzTmFtZT1cInRleHQtY2xhdWRlLXRleHRTZWNvbmRhcnlcIiAvPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICBBZGQgZmlsZXMgb3IgcGhvdG9zXHJcbiAgICAgICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwicmVsYXRpdmVcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPGJ1dHRvbiBvbk1vdXNlRW50ZXI9eygpID0+IHNldFNob3dTa2lsbHNTdWJtZW51KHRydWUpfSBvbkNsaWNrPXsoKSA9PiBzZXRTaG93U2tpbGxzU3VibWVudShwID0+ICFwKX0gY2xhc3NOYW1lPVwidy1mdWxsIGZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktYmV0d2VlbiBweC00IHB5LTIuNSB0ZXh0LVsxM3B4XSB0ZXh0LWNsYXVkZS10ZXh0IGhvdmVyOmJnLWNsYXVkZS1ob3ZlciB0cmFuc2l0aW9uLWNvbG9yc1wiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTNcIj48RmlsZVRleHQgc2l6ZT17MTZ9IGNsYXNzTmFtZT1cInRleHQtY2xhdWRlLXRleHRTZWNvbmRhcnlcIiAvPlNraWxsczwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxDaGV2cm9uRG93biBzaXplPXsxNH0gY2xhc3NOYW1lPVwidGV4dC1jbGF1ZGUtdGV4dFNlY29uZGFyeSAtcm90YXRlLTkwXCIgLz5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHtzaG93U2tpbGxzU3VibWVudSAmJiAoXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJhYnNvbHV0ZSBsZWZ0LWZ1bGwgYm90dG9tLTAgbWwtMSB3LVsyMDBweF0gYmctY2xhdWRlLWlucHV0IGJvcmRlciBib3JkZXItY2xhdWRlLWJvcmRlciByb3VuZGVkLXhsIHNoYWRvdy1bMF80cHhfMTZweF9yZ2JhKDAsMCwwLDAuMTIpXSBweS0xLjUgei01MCBtYXgtaC1bMzAwcHhdIG92ZXJmbG93LXktYXV0b1wiIG9uTW91c2VMZWF2ZT17KCkgPT4gc2V0U2hvd1NraWxsc1N1Ym1lbnUoZmFsc2UpfT5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtlbmFibGVkU2tpbGxzLmxlbmd0aCA+IDAgPyBlbmFibGVkU2tpbGxzLm1hcChza2lsbCA9PiAoXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxidXR0b24ga2V5PXtza2lsbC5pZH0gb25DbGljaz17KCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNldFNob3dQbHVzTWVudShmYWxzZSk7IHNldFNob3dTa2lsbHNTdWJtZW51KGZhbHNlKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzbHVnID0gc2tpbGwubmFtZS50b0xvd2VyQ2FzZSgpLnJlcGxhY2UoL1xccysvZywgJy0nKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZXRTZWxlY3RlZFNraWxsKHsgbmFtZTogc2tpbGwubmFtZSwgc2x1ZywgZGVzY3JpcHRpb246IHNraWxsLmRlc2NyaXB0aW9uIH0pO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNldE1lc3NhZ2UocHJldiA9PiBwcmV2ID8gYC8ke3NsdWd9ICR7cHJldn1gIDogYC8ke3NsdWd9IGApO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRleHRhcmVhUmVmLmN1cnJlbnQ/LmZvY3VzKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH19IGNsYXNzTmFtZT1cInctZnVsbCB0ZXh0LWxlZnQgcHgtNCBweS0yIHRleHQtWzEzcHhdIHRleHQtY2xhdWRlLXRleHQgaG92ZXI6YmctY2xhdWRlLWhvdmVyIHRyYW5zaXRpb24tY29sb3JzIHRydW5jYXRlXCI+e3NraWxsLm5hbWV9PC9idXR0b24+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICApKSA6IDxkaXYgY2xhc3NOYW1lPVwicHgtNCBweS0yIHRleHQtWzEycHhdIHRleHQtY2xhdWRlLXRleHRTZWNvbmRhcnkgaXRhbGljXCI+Tm8gc2tpbGxzIGVuYWJsZWQ8L2Rpdj59XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImJvcmRlci10IGJvcmRlci1jbGF1ZGUtYm9yZGVyIG10LTEgcHQtMVwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8YnV0dG9uIG9uQ2xpY2s9eygpID0+IHsgc2V0U2hvd1BsdXNNZW51KGZhbHNlKTsgd2luZG93LmxvY2F0aW9uLmhhc2ggPSAnIy9jdXN0b21pemUnOyB9fSBjbGFzc05hbWU9XCJ3LWZ1bGwgZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTMgcHgtNCBweS0yIHRleHQtWzEzcHhdIHRleHQtY2xhdWRlLXRleHRTZWNvbmRhcnkgaG92ZXI6YmctY2xhdWRlLWhvdmVyIHRyYW5zaXRpb24tY29sb3JzXCI+PEZpbGVUZXh0IHNpemU9ezE0fSAvPk1hbmFnZSBza2lsbHM8L2J1dHRvbj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICApfVxyXG4gICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICl9XHJcbiAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTNcIj5cclxuICAgICAgICAgICAgICAgICAgPE1vZGVsU2VsZWN0b3JcclxuICAgICAgICAgICAgICAgICAgICBjdXJyZW50TW9kZWxTdHJpbmc9e2N1cnJlbnRNb2RlbFN0cmluZ31cclxuICAgICAgICAgICAgICAgICAgICBtb2RlbHM9e3NlbGVjdG9yTW9kZWxzfVxyXG4gICAgICAgICAgICAgICAgICAgIG9uTW9kZWxDaGFuZ2U9e2hhbmRsZU1vZGVsQ2hhbmdlfVxyXG4gICAgICAgICAgICAgICAgICAgIGlzTmV3Q2hhdD17dHJ1ZX1cclxuICAgICAgICAgICAgICAgICAgLz5cclxuICAgICAgICAgICAgICAgICAgPGJ1dHRvblxyXG4gICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9e2hhbmRsZUNoYXRTdWJtaXR9XHJcbiAgICAgICAgICAgICAgICAgICAgZGlzYWJsZWQ9eyFtZXNzYWdlLnRyaW0oKX1cclxuICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJwLTIgYmctWyNDNjYxM0ZdIHRleHQtd2hpdGUgcm91bmRlZC1sZyBob3ZlcjpiZy1bI0Q5Nzc1N10gdHJhbnNpdGlvbi1jb2xvcnMgZGlzYWJsZWQ6b3BhY2l0eS00MCBkaXNhYmxlZDpjdXJzb3Itbm90LWFsbG93ZWRcIlxyXG4gICAgICAgICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgICAgICAgPEFycm93VXAgc2l6ZT17MjJ9IHN0cm9rZVdpZHRoPXsyLjV9IC8+XHJcbiAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICAgICAgey8qIENvbnZlcnNhdGlvbiBMaXN0IC8gQmFubmVyICovfVxyXG4gICAgICAgICAgICB7Y3VycmVudFByb2plY3QuY29udmVyc2F0aW9ucyAmJiBjdXJyZW50UHJvamVjdC5jb252ZXJzYXRpb25zLmxlbmd0aCA+IDAgPyAoXHJcbiAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJib3JkZXIgYm9yZGVyLWNsYXVkZS1ib3JkZXIgcm91bmRlZC1bMTZweF0gb3ZlcmZsb3ctaGlkZGVuIGJnLXRyYW5zcGFyZW50IG10LTJcIj5cclxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwicHgtNSBweS0zIHRleHQtWzEzcHhdIGZvbnQtbWVkaXVtIHRleHQtY2xhdWRlLXRleHRTZWNvbmRhcnkgYm9yZGVyLWIgYm9yZGVyLWNsYXVkZS1ib3JkZXJcIj5cclxuICAgICAgICAgICAgICAgICAge2N1cnJlbnRQcm9qZWN0LmNvbnZlcnNhdGlvbnMubGVuZ3RofSBjb252ZXJzYXRpb257Y3VycmVudFByb2plY3QuY29udmVyc2F0aW9ucy5sZW5ndGggPiAxID8gJ3MnIDogJyd9XHJcbiAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgIHtjdXJyZW50UHJvamVjdC5jb252ZXJzYXRpb25zLm1hcCgoY29udjogYW55KSA9PiAoXHJcbiAgICAgICAgICAgICAgICAgIDxkaXZcclxuICAgICAgICAgICAgICAgICAgICBrZXk9e2NvbnYuaWR9XHJcbiAgICAgICAgICAgICAgICAgICAgb25DbGljaz17KCkgPT4gbmF2aWdhdGUoYC9jaGF0LyR7Y29udi5pZH1gKX1cclxuICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJweC01IHB5LTMgZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTMgaG92ZXI6YmctY2xhdWRlLWhvdmVyIGN1cnNvci1wb2ludGVyIGJvcmRlci1iIGJvcmRlci1jbGF1ZGUtYm9yZGVyIGxhc3Q6Ym9yZGVyLWItMCB0cmFuc2l0aW9uLWNvbG9ycyBncm91cFwiXHJcbiAgICAgICAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICAgICAgICA8TWVzc2FnZVNxdWFyZSBzaXplPXsxNn0gY2xhc3NOYW1lPVwidGV4dC1jbGF1ZGUtdGV4dFNlY29uZGFyeSBmbGV4LXNocmluay0wXCIgLz5cclxuICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LVsxNHB4XSB0ZXh0LWNsYXVkZS10ZXh0IHRydW5jYXRlXCI+e2NvbnYudGl0bGV9PC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cInRleHQtWzEycHhdIHRleHQtY2xhdWRlLXRleHRTZWNvbmRhcnkgbWwtYXV0byBmbGV4LXNocmluay0wXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICB7bmV3IERhdGUoY29udi5jcmVhdGVkX2F0KS50b0xvY2FsZURhdGVTdHJpbmcoKX1cclxuICAgICAgICAgICAgICAgICAgICA8L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgICAgPGJ1dHRvblxyXG4gICAgICAgICAgICAgICAgICAgICAgb25DbGljaz17KGUpID0+IGhhbmRsZURlbGV0ZUNvbnZlcnNhdGlvbihjb252LmlkLCBlKX1cclxuICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cInAtMSB0ZXh0LWNsYXVkZS10ZXh0U2Vjb25kYXJ5IGhvdmVyOnRleHQtcmVkLTUwMCBvcGFjaXR5LTAgZ3JvdXAtaG92ZXI6b3BhY2l0eS0xMDAgdHJhbnNpdGlvbi1vcGFjaXR5IGZsZXgtc2hyaW5rLTBcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgdGl0bGU9XCJEZWxldGUgY29udmVyc2F0aW9uXCJcclxuICAgICAgICAgICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8VHJhc2ggc2l6ZT17MTR9IC8+XHJcbiAgICAgICAgICAgICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgKSl9XHJcbiAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICkgOiAoXHJcbiAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJ3LWZ1bGwgYm9yZGVyIGJvcmRlci1jbGF1ZGUtYm9yZGVyIHJvdW5kZWQtWzE2cHhdIHB4LTYgcHktMTAgZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgYmctdHJhbnNwYXJlbnQgbXQtMlwiPlxyXG4gICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwidGV4dC1bMTQuNXB4XSB0ZXh0LVsjQTFBMUFBXVwiPlxyXG4gICAgICAgICAgICAgICAgICBTdGFydCBhIGNoYXQgdG8ga2VlcCBjb252ZXJzYXRpb25zIG9yZ2FuaXplZCBhbmQgcmUtdXNlIHByb2plY3Qga25vd2xlZGdlLlxyXG4gICAgICAgICAgICAgICAgPC9zcGFuPlxyXG4gICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICApfVxyXG5cclxuICAgICAgICAgICAgey8qIEluc3RydWN0aW9ucyBhbmQgRmlsZXMgKi99XHJcbiAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwidy1mdWxsIGJvcmRlciBib3JkZXItY2xhdWRlLWJvcmRlciByb3VuZGVkLVsxNnB4XSBvdmVyZmxvdy1oaWRkZW4gYmctdHJhbnNwYXJlbnQgbXQtMlwiPlxyXG4gICAgICAgICAgICAgIHsvKiBJbnN0cnVjdGlvbnMgSGVhZGVyICovfVxyXG4gICAgICAgICAgICAgIDxkaXZcclxuICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cInAtNSBib3JkZXItYiBib3JkZXItY2xhdWRlLWJvcmRlciBob3ZlcjpiZy1ibGFjay9bMC4wMTVdIGRhcms6aG92ZXI6Ymctd2hpdGUvWzAuMDE1XSB0cmFuc2l0aW9uLWNvbG9ycyBjdXJzb3ItcG9pbnRlciBncm91cFwiXHJcbiAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiB7IGlmICghZWRpdGluZ0luc3RydWN0aW9ucykgc2V0RWRpdGluZ0luc3RydWN0aW9ucyh0cnVlKTsgfX1cclxuICAgICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktYmV0d2VlblwiPlxyXG4gICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXgtMVwiPlxyXG4gICAgICAgICAgICAgICAgICAgIDxoMyBjbGFzc05hbWU9XCJmb250LXNlbWlib2xkIHRleHQtY2xhdWRlLXRleHQgbWItMC41XCIgc3R5bGU9e3sgZm9udFNpemU6ICcxNS41cHgnIH19Pkluc3RydWN0aW9uczwvaDM+XHJcbiAgICAgICAgICAgICAgICAgICAgeyFlZGl0aW5nSW5zdHJ1Y3Rpb25zICYmIChcclxuICAgICAgICAgICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQtWzEzcHhdIHRleHQtWyNBMUExQUFdXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHtjdXJyZW50UHJvamVjdC5pbnN0cnVjdGlvbnNcclxuICAgICAgICAgICAgICAgICAgICAgICAgICA/IGN1cnJlbnRQcm9qZWN0Lmluc3RydWN0aW9ucy5zbGljZSgwLCAyMDApICsgKGN1cnJlbnRQcm9qZWN0Lmluc3RydWN0aW9ucy5sZW5ndGggPiAyMDAgPyAnLi4uJyA6ICcnKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDogXCJBZGQgaW5zdHJ1Y3Rpb25zIHRvIHRhaWxvciBDbGF1ZGUncyByZXNwb25zZXNcIn1cclxuICAgICAgICAgICAgICAgICAgICAgIDwvcD5cclxuICAgICAgICAgICAgICAgICAgICApfVxyXG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgeyFlZGl0aW5nSW5zdHJ1Y3Rpb25zICYmIChcclxuICAgICAgICAgICAgICAgICAgICA8YnV0dG9uIGNsYXNzTmFtZT1cInRleHQtWyNBMUExQUFdIGhvdmVyOnRleHQtY2xhdWRlLXRleHQgdHJhbnNpdGlvbi1jb2xvcnNcIj5cclxuICAgICAgICAgICAgICAgICAgICAgIHtjdXJyZW50UHJvamVjdC5pbnN0cnVjdGlvbnMgPyA8UGVuY2lsIHNpemU9ezE4fSBzdHJva2VXaWR0aD17MS41fSAvPiA6IDxQbHVzIHNpemU9ezIyfSBzdHJva2VXaWR0aD17MS41fSAvPn1cclxuICAgICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICAgICAgICAgICAgKX1cclxuICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAge2VkaXRpbmdJbnN0cnVjdGlvbnMgJiYgKFxyXG4gICAgICAgICAgICAgICAgICA8ZGl2XHJcbiAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwiZml4ZWQgaW5zZXQtMCB6LTUwIGZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIGJnLWJsYWNrLzcwXCJcclxuICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiB7IHNldEVkaXRpbmdJbnN0cnVjdGlvbnMoZmFsc2UpOyBzZXRJbnN0cnVjdGlvbnNUZXh0KGN1cnJlbnRQcm9qZWN0Lmluc3RydWN0aW9ucyB8fCAnJyk7IH19XHJcbiAgICAgICAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICAgICAgICA8ZGl2XHJcbiAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJ3LWZ1bGwgbWF4LXctWzgwMHB4XSBiZy13aGl0ZSBkYXJrOmJnLVsjMkEyOTI4XSBib3JkZXIgYm9yZGVyLWNsYXVkZS1ib3JkZXIgcm91bmRlZC1bMjBweF0gc2hhZG93LTJ4bCBwLTdcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgb25DbGljaz17ZSA9PiBlLnN0b3BQcm9wYWdhdGlvbigpfVxyXG4gICAgICAgICAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICAgICAgICAgIDxoMiBjbGFzc05hbWU9XCJ0ZXh0LVsyMHB4XSBmb250LWJvbGQgdGV4dC1jbGF1ZGUtdGV4dCBtYi0yXCI+U2V0IHByb2plY3QgaW5zdHJ1Y3Rpb25zPC9oMj5cclxuICAgICAgICAgICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQtWzE0cHhdIHRleHQtWyNBMUExQUFdIG1iLTVcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgUHJvdmlkZSBDbGF1ZGUgd2l0aCByZWxldmFudCBpbnN0cnVjdGlvbnMgYW5kIGluZm9ybWF0aW9uIGZvciBjaGF0cyB3aXRoaW4ge2N1cnJlbnRQcm9qZWN0Lm5hbWV9LiBUaGlzIHdpbGwgd29yayBhbG9uZ3NpZGUgPHNwYW4gY2xhc3NOYW1lPVwidW5kZXJsaW5lIGRlY29yYXRpb24tWyM1NTVdIHVuZGVybGluZS1vZmZzZXQtMiBjdXJzb3ItcG9pbnRlciBob3Zlcjp0ZXh0LWNsYXVkZS10ZXh0XCI+dXNlciBwcmVmZXJlbmNlczwvc3Bhbj4gYW5kIHRoZSBzZWxlY3RlZCBzdHlsZSBpbiBhIGNoYXQuXHJcbiAgICAgICAgICAgICAgICAgICAgICA8L3A+XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgPHRleHRhcmVhXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGF1dG9Gb2N1c1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZT17aW5zdHJ1Y3Rpb25zVGV4dH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgb25DaGFuZ2U9e2UgPT4gc2V0SW5zdHJ1Y3Rpb25zVGV4dChlLnRhcmdldC52YWx1ZSl9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHBsYWNlaG9sZGVyPVwiQnJlYWsgZG93biBsYXJnZSB0YXNrcyBhbmQgYXNrIGNsYXJpZnlpbmcgcXVlc3Rpb25zIHdoZW4gbmVlZGVkLlwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cInctZnVsbCBoLVs0MDBweF0gcHgtNCBweS0zIGJnLWNsYXVkZS1iZyBkYXJrOmJnLVsjMjAyMDIwXSBib3JkZXIgYm9yZGVyLWNsYXVkZS1ib3JkZXIgcm91bmRlZC1bMTJweF0gdGV4dC1bMTVweF0gdGV4dC1jbGF1ZGUtdGV4dCByZXNpemUtbm9uZSBvdXRsaW5lLW5vbmUgZm9jdXM6Ym9yZGVyLVsjM0E3QURBXSBmb2N1czpyaW5nLTEgZm9jdXM6cmluZy1bIzNBN0FEQV0gdHJhbnNpdGlvbi1jb2xvcnNcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgLz5cclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXgganVzdGlmeS1lbmQgZ2FwLTMgbXQtNVwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8YnV0dG9uXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgb25DbGljaz17KCkgPT4geyBzZXRFZGl0aW5nSW5zdHJ1Y3Rpb25zKGZhbHNlKTsgc2V0SW5zdHJ1Y3Rpb25zVGV4dChjdXJyZW50UHJvamVjdC5pbnN0cnVjdGlvbnMgfHwgJycpOyB9fVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cInB4LTQgcHktMiB0ZXh0LVsxNHB4XSBmb250LW1lZGl1bSB0ZXh0LWNsYXVkZS10ZXh0IGhvdmVyOmJnLXdoaXRlLzUgYm9yZGVyIGJvcmRlci10cmFuc3BhcmVudCBob3Zlcjpib3JkZXItY2xhdWRlLWJvcmRlciByb3VuZGVkLXhsIHRyYW5zaXRpb24tYWxsXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIENhbmNlbFxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPGJ1dHRvblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9e2hhbmRsZVNhdmVJbnN0cnVjdGlvbnN9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwicHgtNCBweS0yIHRleHQtWzE0cHhdIGZvbnQtbWVkaXVtIGJnLVsjRTZFNkU2XSB0ZXh0LVsjMjIyXSByb3VuZGVkLXhsIGhvdmVyOm9wYWNpdHktOTAgdHJhbnNpdGlvbi1vcGFjaXR5XCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIFNhdmUgaW5zdHJ1Y3Rpb25zXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgKX1cclxuICAgICAgICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgICAgICAgey8qIEZpbGVzICovfVxyXG4gICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwicC01IHBiLTZcIj5cclxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1iZXR3ZWVuIG1iLTRcIj5cclxuICAgICAgICAgICAgICAgICAgPGgzIGNsYXNzTmFtZT1cImZvbnQtc2VtaWJvbGQgdGV4dC1jbGF1ZGUtdGV4dFwiIHN0eWxlPXt7IGZvbnRTaXplOiAnMTUuNXB4JyB9fT5cclxuICAgICAgICAgICAgICAgICAgICBGaWxlcyB7Y3VycmVudFByb2plY3QuZmlsZXM/Lmxlbmd0aCA+IDAgJiYgPHNwYW4gY2xhc3NOYW1lPVwidGV4dC1jbGF1ZGUtdGV4dFNlY29uZGFyeSB0ZXh0LVsxM3B4XSBtbC0xXCI+KHtjdXJyZW50UHJvamVjdC5maWxlcy5sZW5ndGh9KTwvc3Bhbj59XHJcbiAgICAgICAgICAgICAgICAgIDwvaDM+XHJcbiAgICAgICAgICAgICAgICAgIDxidXR0b25cclxuICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBmaWxlSW5wdXRSZWYuY3VycmVudD8uY2xpY2soKX1cclxuICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJ0ZXh0LVsjQTFBMUFBXSBob3Zlcjp0ZXh0LWNsYXVkZS10ZXh0IHRyYW5zaXRpb24tY29sb3JzXCJcclxuICAgICAgICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgICAgICAgIDxQbHVzIHNpemU9ezIyfSBzdHJva2VXaWR0aD17MS41fSAvPlxyXG4gICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICAgICAgICAgICAgPGlucHV0XHJcbiAgICAgICAgICAgICAgICAgICAgcmVmPXtmaWxlSW5wdXRSZWZ9XHJcbiAgICAgICAgICAgICAgICAgICAgdHlwZT1cImZpbGVcIlxyXG4gICAgICAgICAgICAgICAgICAgIG11bHRpcGxlXHJcbiAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwiaGlkZGVuXCJcclxuICAgICAgICAgICAgICAgICAgICBvbkNoYW5nZT17ZSA9PiB7IGlmIChlLnRhcmdldC5maWxlcykgaGFuZGxlRmlsZVVwbG9hZChlLnRhcmdldC5maWxlcyk7IGUudGFyZ2V0LnZhbHVlID0gJyc7IH19XHJcbiAgICAgICAgICAgICAgICAgIC8+XHJcbiAgICAgICAgICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgICAgICAgICB7dXBsb2FkaW5nICYmIChcclxuICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJ0ZXh0LVsxM3B4XSB0ZXh0LWNsYXVkZS10ZXh0U2Vjb25kYXJ5IGFuaW1hdGUtcHVsc2UgbWItM1wiPlVwbG9hZGluZy4uLjwvZGl2PlxyXG4gICAgICAgICAgICAgICAgKX1cclxuXHJcbiAgICAgICAgICAgICAgICB7Y3VycmVudFByb2plY3QuZmlsZXMgJiYgY3VycmVudFByb2plY3QuZmlsZXMubGVuZ3RoID4gMCA/IChcclxuICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJzcGFjZS15LTJcIj5cclxuICAgICAgICAgICAgICAgICAgICB7Y3VycmVudFByb2plY3QuZmlsZXMubWFwKChmOiBQcm9qZWN0RmlsZSkgPT4gKFxyXG4gICAgICAgICAgICAgICAgICAgICAgPGRpdiBrZXk9e2YuaWR9IGNsYXNzTmFtZT1cImZsZXggaXRlbXMtY2VudGVyIGdhcC0zIHB4LTMgcHktMi41IHJvdW5kZWQtWzEycHhdIGJnLWJsYWNrL1swLjAyXSBkYXJrOmJnLXdoaXRlL1swLjAzXSBncm91cCBib3JkZXIgYm9yZGVyLXRyYW5zcGFyZW50IGhvdmVyOmJvcmRlci1jbGF1ZGUtYm9yZGVyIHRyYW5zaXRpb24tYWxsXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxGaWxlVGV4dCBzaXplPXsxNn0gY2xhc3NOYW1lPVwidGV4dC1bI0ExQTFBQV0gZmxleC1zaHJpbmstMFwiIC8+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleC0xIG1pbi13LTBcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInRleHQtWzEzLjVweF0gdGV4dC1jbGF1ZGUtdGV4dCB0cnVuY2F0ZSBmb250LW1lZGl1bVwiPntmLmZpbGVfbmFtZX08L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInRleHQtWzExLjVweF0gdGV4dC1bI0ExQTFBQV1cIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHtmLmZpbGVfc2l6ZSA+IDEwMjQgKiAxMDI0ID8gYCR7KGYuZmlsZV9zaXplIC8gMTAyNCAvIDEwMjQpLnRvRml4ZWQoMSl9IE1CYCA6IGAkeyhmLmZpbGVfc2l6ZSAvIDEwMjQpLnRvRml4ZWQoMSl9IEtCYH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxidXR0b25cclxuICAgICAgICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBoYW5kbGVEZWxldGVGaWxlKGYuaWQpfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cInAtMSB0ZXh0LVsjQTFBMUFBXSBob3Zlcjp0ZXh0LXJlZC01MDAgb3BhY2l0eS0wIGdyb3VwLWhvdmVyOm9wYWNpdHktMTAwIHRyYW5zaXRpb24tb3BhY2l0eVwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8WCBzaXplPXsxNn0gLz5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICApKX1cclxuICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICApIDogKFxyXG4gICAgICAgICAgICAgICAgICA8ZGl2XHJcbiAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwidy1mdWxsIGJnLVsjRkFGQUZBXSBkYXJrOmJnLVsjMTkxOTE5XSByb3VuZGVkLVsxNnB4XSBmbGV4IGZsZXgtY29sIGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciBweS04IGJvcmRlciBib3JkZXItdHJhbnNwYXJlbnQgZGFyazpib3JkZXItd2hpdGUvWzAuMDRdIGN1cnNvci1wb2ludGVyIGhvdmVyOmJnLVsjRjNGM0YzXSBkYXJrOmhvdmVyOmJnLVsjMjIyMjIyXSB0cmFuc2l0aW9uLWNvbG9yc1wiXHJcbiAgICAgICAgICAgICAgICAgICAgb25DbGljaz17KCkgPT4gZmlsZUlucHV0UmVmLmN1cnJlbnQ/LmNsaWNrKCl9XHJcbiAgICAgICAgICAgICAgICAgICAgb25EcmFnT3Zlcj17ZSA9PiB7IGUucHJldmVudERlZmF1bHQoKTsgZS5zdG9wUHJvcGFnYXRpb24oKTsgfX1cclxuICAgICAgICAgICAgICAgICAgICBvbkRyb3A9e2UgPT4geyBlLnByZXZlbnREZWZhdWx0KCk7IGUuc3RvcFByb3BhZ2F0aW9uKCk7IGlmIChlLmRhdGFUcmFuc2Zlci5maWxlcy5sZW5ndGgpIGhhbmRsZUZpbGVVcGxvYWQoZS5kYXRhVHJhbnNmZXIuZmlsZXMpOyB9fVxyXG4gICAgICAgICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciBtYi0zXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInctWzg0cHhdIGgtWzQ4cHhdIHJlbGF0aXZlIG9wYWNpdHktNjAgbWl4LWJsZW5kLWx1bWlub3NpdHkgZ3JheXNjYWxlXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiYWJzb2x1dGUgcmlnaHQtWzRweF0gYm90dG9tLTAgdy1bMjhweF0gaC1bMzZweF0gYmctWyMzQjNCM0JdIGJvcmRlciBib3JkZXItWyM1NTVdIHJvdW5kZWQtWzRweF0gZmxleCBmbGV4LWNvbCBpdGVtcy1jZW50ZXIgcHktMS41IHB4LTEgZ2FwLVszcHhdIHNoYWRvdy1zbSB0cmFuc2Zvcm0gdHJhbnNsYXRlLXgtMiB0cmFuc2xhdGUteS0yIC1yb3RhdGUtMTIgei0wXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJ3LWZ1bGwgaC1bMS41cHhdIGJnLVsjNjY2XSByb3VuZGVkLWZ1bGwgbXgtMVwiPjwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwidy0zLzQgaC1bMS41cHhdIGJnLVsjNjY2XSByb3VuZGVkLWZ1bGwgbXgtMSBzZWxmLXN0YXJ0XCI+PC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImFic29sdXRlIGxlZnQtWzRweF0gYm90dG9tLTAgdy1bMjhweF0gaC1bMzZweF0gYmctWyMzQjNCM0JdIGJvcmRlciBib3JkZXItWyM1NTVdIHJvdW5kZWQtWzRweF0gZmxleCBmbGV4LWNvbCBpdGVtcy1jZW50ZXIgcHktMS41IHB4LTEgZ2FwLVszcHhdIHNoYWRvdy1zbSB0cmFuc2Zvcm0gLXRyYW5zbGF0ZS14LTIgdHJhbnNsYXRlLXktMSByb3RhdGUtMTIgei0wXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJ3LWZ1bGwgaC1bMS41cHhdIGJnLVsjNjY2XSByb3VuZGVkLWZ1bGwgbXgtMVwiPjwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwidy1mdWxsIGgtWzEuNXB4XSBiZy1bIzY2Nl0gcm91bmRlZC1mdWxsIG14LTFcIj48L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInctMS8yIGgtWzEuNXB4XSBiZy1bIzY2Nl0gcm91bmRlZC1mdWxsIG14LTEgc2VsZi1zdGFydFwiPjwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJhYnNvbHV0ZSBsZWZ0LTEvMiBib3R0b20tMCAtdHJhbnNsYXRlLXgtMS8yIHctWzM0cHhdIGgtWzQycHhdIGJnLVsjNDQ0XSBib3JkZXIgYm9yZGVyLVsjNjY2XSByb3VuZGVkLVs2cHhdIHNoYWRvdy1tZCBmbGV4IGZsZXgtY29sIGl0ZW1zLWNlbnRlciBweS0yIHB4LTEuNSBnYXAtWzRweF0gei0xMFwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwidy1bMTJweF0gaC1bMTJweF0gYmctWyM1NTVdIHJvdW5kZWQtc20gZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgc2VsZi1lbmQgbWItMC41XCI+PFBsdXMgc2l6ZT17OH0gY2xhc3NOYW1lPVwidGV4dC13aGl0ZVwiIC8+PC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJ3LWZ1bGwgaC1bMnB4XSBiZy1bIzg4OF0gcm91bmRlZC1mdWxsIG14LTFcIj48L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInctZnVsbCBoLVsycHhdIGJnLVsjODg4XSByb3VuZGVkLWZ1bGwgbXgtMVwiPjwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwidy0yLzMgaC1bMnB4XSBiZy1bIzg4OF0gcm91bmRlZC1mdWxsIG14LTEgc2VsZi1zdGFydFwiPjwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cInRleHQtWzEzcHhdIHRleHQtWyNBMUExQUFdIHRleHQtY2VudGVyIG1heC13LVsyMDBweF0gbGVhZGluZy1yZWxheGVkXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICBBZGQgUERGcywgZG9jdW1lbnRzLCBvciBvdGhlciB0ZXh0IHRvIHJlZmVyZW5jZSBpbiB0aGlzIHByb2plY3QuXHJcbiAgICAgICAgICAgICAgICAgICAgPC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICl9XHJcbiAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgPC9kaXY+XHJcbiAgICAgIDwvZGl2PlxyXG4gICAgKTtcclxuICB9XHJcblxyXG4gIC8vIOKVkOKVkOKVkCBQcm9qZWN0cyBMaXN0IFZpZXcg4pWQ4pWQ4pWQXG4gIHJldHVybiAoXG4gICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4LTEgaC1mdWxsIGJnLWNsYXVkZS1iZyBvdmVyZmxvdy15LWF1dG9cIj5cbiAgICAgIDxkaXYgY2xhc3NOYW1lPVwibWF4LXctWzgwMHB4XSBteC1hdXRvIHB4LTggcHktMTJcIj5cclxuICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktYmV0d2VlbiBtYi04XCI+XHJcbiAgICAgICAgICA8aDEgY2xhc3NOYW1lPVwiZm9udC1bU3BlY3RyYWxdIHRleHQtWzMycHhdIHRleHQtY2xhdWRlLXRleHRcIiBzdHlsZT17eyBmb250V2VpZ2h0OiA1MDAgfX0+UHJvamVjdHM8L2gxPlxyXG4gICAgICAgICAgPGJ1dHRvblxyXG4gICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBzZXRJc0NyZWF0aW5nKHRydWUpfVxyXG4gICAgICAgICAgICBjbGFzc05hbWU9XCJmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMiBweC0zLjUgcHktMS41IGJnLWNsYXVkZS10ZXh0IHRleHQtY2xhdWRlLWJnIGhvdmVyOm9wYWNpdHktOTAgcm91bmRlZC1sZyB0cmFuc2l0aW9uLW9wYWNpdHkgZm9udC1tZWRpdW1cIlxyXG4gICAgICAgICAgICBzdHlsZT17eyBmb250U2l6ZTogJzE0cHgnIH19XHJcbiAgICAgICAgICA+XHJcbiAgICAgICAgICAgIDxQbHVzIHNpemU9ezE2fSBzdHJva2VXaWR0aD17Mi41fSAvPlxyXG4gICAgICAgICAgICBOZXcgcHJvamVjdFxyXG4gICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgIHtwcm9qZWN0cy5sZW5ndGggPiAwICYmIChcclxuICAgICAgICAgIDw+XHJcbiAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwicmVsYXRpdmUgbWItNlwiPlxyXG4gICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiYWJzb2x1dGUgaW5zZXQteS0wIGxlZnQtMyBmbGV4IGl0ZW1zLWNlbnRlciBwb2ludGVyLWV2ZW50cy1ub25lXCI+XHJcbiAgICAgICAgICAgICAgICA8U2VhcmNoIGNsYXNzTmFtZT1cImgtNSB3LTUgdGV4dC1jbGF1ZGUtdGV4dFNlY29uZGFyeSBvcGFjaXR5LTgwXCIgLz5cclxuICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICA8aW5wdXRcclxuICAgICAgICAgICAgICAgIHR5cGU9XCJ0ZXh0XCJcclxuICAgICAgICAgICAgICAgIHBsYWNlaG9sZGVyPVwiU2VhcmNoIHByb2plY3RzLi4uXCJcclxuICAgICAgICAgICAgICAgIHZhbHVlPXtzZWFyY2hRdWVyeX1cclxuICAgICAgICAgICAgICAgIG9uQ2hhbmdlPXtlID0+IHNldFNlYXJjaFF1ZXJ5KGUudGFyZ2V0LnZhbHVlKX1cclxuICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cInctZnVsbCBwbC0xMCBwci00IHB5LTMgYmctd2hpdGUgZGFyazpiZy1jbGF1ZGUtaW5wdXQgYm9yZGVyIGJvcmRlci1ncmF5LTIwMCBkYXJrOmJvcmRlci1jbGF1ZGUtYm9yZGVyIHJvdW5kZWQteGwgdGV4dC1jbGF1ZGUtdGV4dCBwbGFjZWhvbGRlci1jbGF1ZGUtdGV4dFNlY29uZGFyeSBmb2N1czpvdXRsaW5lLW5vbmUgZm9jdXM6cmluZy0yIGZvY3VzOnJpbmctYmx1ZS01MDAvMjAgZm9jdXM6Ym9yZGVyLWJsdWUtNTAwIHRyYW5zaXRpb24tYWxsIHRleHQtWzE1cHhdXCJcclxuICAgICAgICAgICAgICAvPlxyXG4gICAgICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBqdXN0aWZ5LWVuZCBtYi02XCI+XHJcbiAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMyB0ZXh0LVsxNC41cHhdIHRleHQtWyNBMUExQUFdIHJlbGF0aXZlXCI+XHJcbiAgICAgICAgICAgICAgICA8c3Bhbj5Tb3J0IGJ5PC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgPGJ1dHRvblxyXG4gICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBzZXRTb3J0TWVudU9wZW4oIXNvcnRNZW51T3Blbil9XHJcbiAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT17YGZsZXggaXRlbXMtY2VudGVyIGdhcC0yIHRleHQtY2xhdWRlLXRleHQgYm9yZGVyIGJvcmRlci1bIzNBM0EzQV0gaG92ZXI6Ym9yZGVyLVsjNEE0QTRBXSBkYXJrOmJvcmRlci1jbGF1ZGUtYm9yZGVyIGRhcms6aG92ZXI6YmctY2xhdWRlLWhvdmVyIHJvdW5kZWQtWzEwcHhdIHB4LTMuNSBweS0xLjUgdHJhbnNpdGlvbi1jb2xvcnMgJHtzb3J0TWVudU9wZW4gPyAnYmctY2xhdWRlLWhvdmVyJyA6ICcnfWB9XHJcbiAgICAgICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgICAgIHtzb3J0QnkgPT09ICdhY3Rpdml0eScgPyAnQWN0aXZpdHknIDogc29ydEJ5ID09PSAnZWRpdGVkJyA/ICdMYXN0IGVkaXRlZCcgOiAnRGF0ZSBjcmVhdGVkJ31cclxuICAgICAgICAgICAgICAgICAgPENoZXZyb25Eb3duIHNpemU9ezE0fSBjbGFzc05hbWU9XCJ0ZXh0LWNsYXVkZS10ZXh0U2Vjb25kYXJ5XCIgLz5cclxuICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgICAgICAgICAge3NvcnRNZW51T3BlbiAmJiAoXHJcbiAgICAgICAgICAgICAgICAgIDw+XHJcbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmaXhlZCBpbnNldC0wIHotNDBcIiBvbkNsaWNrPXsoKSA9PiBzZXRTb3J0TWVudU9wZW4oZmFsc2UpfSAvPlxyXG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiYWJzb2x1dGUgdG9wLWZ1bGwgcmlnaHQtMCBtdC0xLjUgdy1bMjAwcHhdIGJnLXdoaXRlIGRhcms6YmctWyMyQTI5MjhdIGJvcmRlciBib3JkZXItZ3JheS0yMDAgZGFyazpib3JkZXItY2xhdWRlLWJvcmRlciByb3VuZGVkLVsxNHB4XSBzaGFkb3ctbGcgcHktMS41IHotNTBcIj5cclxuICAgICAgICAgICAgICAgICAgICAgIHtbXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHsgaWQ6ICdhY3Rpdml0eScsIGxhYmVsOiAnUmVjZW50IGFjdGl2aXR5JyB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB7IGlkOiAnZWRpdGVkJywgbGFiZWw6ICdMYXN0IGVkaXRlZCcgfSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgeyBpZDogJ2NyZWF0ZWQnLCBsYWJlbDogJ0RhdGUgY3JlYXRlZCcgfSxcclxuICAgICAgICAgICAgICAgICAgICAgIF0ubWFwKG9wdCA9PiAoXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxidXR0b25cclxuICAgICAgICAgICAgICAgICAgICAgICAgICBrZXk9e29wdC5pZH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZXRTb3J0Qnkob3B0LmlkIGFzIGFueSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZXRTb3J0TWVudU9wZW4oZmFsc2UpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIH19XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwidy1mdWxsIGZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktYmV0d2VlbiBweC00IHB5LTIuNSB0ZXh0LVsxNXB4XSB0ZXh0LWNsYXVkZS10ZXh0IGhvdmVyOmJnLWJsYWNrLzUgZGFyazpob3ZlcjpiZy13aGl0ZS81IHRyYW5zaXRpb24tY29sb3JzXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHtvcHQubGFiZWx9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAge3NvcnRCeSA9PT0gb3B0LmlkICYmIDxDaGVjayBzaXplPXsxNn0gY2xhc3NOYW1lPVwidGV4dC1jbGF1ZGUtdGV4dCBvcGFjaXR5LTgwXCIgLz59XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgICAgICAgICAgICAgICAgKSl9XHJcbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgIDwvPlxyXG4gICAgICAgICAgICAgICAgKX1cclxuICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICA8Lz5cclxuICAgICAgICApfVxyXG5cclxuICAgICAgICB7bG9hZGluZyA/IChcclxuICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwidGV4dC1jZW50ZXIgdGV4dC1jbGF1ZGUtdGV4dFNlY29uZGFyeSB0ZXh0LVsxNHB4XSBtdC0xMlwiPkxvYWRpbmcuLi48L2Rpdj5cclxuICAgICAgICApIDogZmlsdGVyZWRQcm9qZWN0cy5sZW5ndGggPiAwID8gKFxyXG4gICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJncmlkIGdyaWQtY29scy0xIG1kOmdyaWQtY29scy0yIGdhcC00XCI+XHJcbiAgICAgICAgICAgIHtmaWx0ZXJlZFByb2plY3RzLm1hcChwID0+IChcclxuICAgICAgICAgICAgICA8ZGl2XHJcbiAgICAgICAgICAgICAgICBrZXk9e3AuaWR9XHJcbiAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBsb2FkUHJvamVjdChwLmlkKX1cclxuICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cImZsZXggZmxleC1jb2wgcC01IGJvcmRlciBib3JkZXItY2xhdWRlLWJvcmRlciByb3VuZGVkLVsxMnB4XSBiZy10cmFuc3BhcmVudCBob3ZlcjpiZy1ibGFjay9bMC4wMl0gZGFyazpob3ZlcjpiZy13aGl0ZS9bMC4wMl0gY3Vyc29yLXBvaW50ZXIgdHJhbnNpdGlvbi1jb2xvcnMgZ3JvdXAgbWluLWgtWzE3MHB4XVwiXHJcbiAgICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWJldHdlZW4gbWItMi41IHJlbGF0aXZlXCI+XHJcbiAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTNcIj5cclxuICAgICAgICAgICAgICAgICAgICA8aDMgY2xhc3NOYW1lPVwidGV4dC1bMTUuNXB4XSBmb250LW1lZGl1bSB0ZXh0LWNsYXVkZS10ZXh0IHRydW5jYXRlXCI+e3AubmFtZX08L2gzPlxyXG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJyZWxhdGl2ZVwiIG9uQ2xpY2s9eyhlKSA9PiBlLnN0b3BQcm9wYWdhdGlvbigpfT5cclxuICAgICAgICAgICAgICAgICAgICA8YnV0dG9uXHJcbiAgICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoZSkgPT4geyBlLnN0b3BQcm9wYWdhdGlvbigpOyBzZXRBY3RpdmVNZW51KGFjdGl2ZU1lbnUgPT09IHAuaWQgPyBudWxsIDogcC5pZCk7IH19XHJcbiAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9e2BwLTEgdGV4dC1bI0ExQTFBQV0gaG92ZXI6dGV4dC1jbGF1ZGUtdGV4dCBob3ZlcjpiZy1ibGFjay81IGRhcms6aG92ZXI6Ymctd2hpdGUvNSByb3VuZGVkLVs2cHhdIHRyYW5zaXRpb24tYWxsICR7YWN0aXZlTWVudSA9PT0gcC5pZCA/ICdvcGFjaXR5LTEwMCBiZy1ibGFjay81IGRhcms6Ymctd2hpdGUvNScgOiAnb3BhY2l0eS0wIGdyb3VwLWhvdmVyOm9wYWNpdHktMTAwJ31gfVxyXG4gICAgICAgICAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICAgICAgICAgIDxNb3JlVmVydGljYWwgc2l6ZT17MTh9IC8+XHJcbiAgICAgICAgICAgICAgICAgICAgPC9idXR0b24+XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIHthY3RpdmVNZW51ID09PSBwLmlkICYmIChcclxuICAgICAgICAgICAgICAgICAgICAgIDw+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZml4ZWQgaW5zZXQtMCB6LTQwXCIgb25DbGljaz17KGUpID0+IHsgZS5zdG9wUHJvcGFnYXRpb24oKTsgc2V0QWN0aXZlTWVudShudWxsKTsgfX0gLz5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJhYnNvbHV0ZSB0b3AtZnVsbCByaWdodC0wIG10LTEgdy1bMTgwcHhdIGJnLXdoaXRlIGRhcms6YmctWyMzMDMwMkVdIHJvdW5kZWQtWzE2cHhdIHNoYWRvdy1bMF80cHhfMjRweF9yZ2JhKDAsMCwwLDAuMTUpXSBib3JkZXIgYm9yZGVyLWdyYXktMjAwIGRhcms6Ym9yZGVyLVsjNjU2NDVGXSBweS0xLjUgei01MFwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxidXR0b24gY2xhc3NOYW1lPVwidy1mdWxsIGZsZXggaXRlbXMtY2VudGVyIGdhcC0zIHB4LTQgcHktMi41IHRleHQtWzE0cHhdIHRleHQtY2xhdWRlLXRleHQgaG92ZXI6YmctYmxhY2svNSBkYXJrOmhvdmVyOmJnLXdoaXRlLzUgdHJhbnNpdGlvbi1jb2xvcnMgdGV4dC1sZWZ0XCIgb25DbGljaz17KGUpID0+IHsgZS5zdG9wUHJvcGFnYXRpb24oKTsgc2V0QWN0aXZlTWVudShudWxsKTsgfX0+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8U3RhciBzaXplPXsxNn0gY2xhc3NOYW1lPVwidGV4dC1jbGF1ZGUtdGV4dFNlY29uZGFyeVwiIC8+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBTdGFyXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPGJ1dHRvbiBjbGFzc05hbWU9XCJ3LWZ1bGwgZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTMgcHgtNCBweS0yLjUgdGV4dC1bMTRweF0gdGV4dC1jbGF1ZGUtdGV4dCBob3ZlcjpiZy1ibGFjay81IGRhcms6aG92ZXI6Ymctd2hpdGUvNSB0cmFuc2l0aW9uLWNvbG9ycyB0ZXh0LWxlZnRcIiBvbkNsaWNrPXsoZSkgPT4geyBlLnN0b3BQcm9wYWdhdGlvbigpOyBzZXRBY3RpdmVNZW51KG51bGwpOyBzZXRQcm9qZWN0VG9FZGl0KHApOyBzZXRFZGl0RGV0YWlsc05hbWUocC5uYW1lKTsgc2V0RWRpdERldGFpbHNEZXNjKHAuZGVzY3JpcHRpb24gfHwgJycpOyB9fT5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxQZW5jaWwgc2l6ZT17MTZ9IGNsYXNzTmFtZT1cInRleHQtY2xhdWRlLXRleHRTZWNvbmRhcnlcIiAvPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgRWRpdCBkZXRhaWxzXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJteS0xLjUgYm9yZGVyLXQgYm9yZGVyLWNsYXVkZS1ib3JkZXIgb3BhY2l0eS01MFwiIC8+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPGJ1dHRvbiBjbGFzc05hbWU9XCJ3LWZ1bGwgZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTMgcHgtNCBweS0yLjUgdGV4dC1bMTRweF0gdGV4dC1jbGF1ZGUtdGV4dCBob3ZlcjpiZy1ibGFjay81IGRhcms6aG92ZXI6Ymctd2hpdGUvNSB0cmFuc2l0aW9uLWNvbG9ycyB0ZXh0LWxlZnRcIiBvbkNsaWNrPXsoZSkgPT4geyBlLnN0b3BQcm9wYWdhdGlvbigpOyBzZXRBY3RpdmVNZW51KG51bGwpOyB9fT5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxBcmNoaXZlIHNpemU9ezE2fSBjbGFzc05hbWU9XCJ0ZXh0LWNsYXVkZS10ZXh0U2Vjb25kYXJ5XCIgLz5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIEFyY2hpdmVcclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8YnV0dG9uIGNsYXNzTmFtZT1cInctZnVsbCBmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMyBweC00IHB5LTIuNSB0ZXh0LVsxNHB4XSB0ZXh0LVsjRTA1QTVBXSBob3ZlcjpiZy1yZWQtNTAwLzEwIHRyYW5zaXRpb24tY29sb3JzIHRleHQtbGVmdFwiIG9uQ2xpY2s9eyhlKSA9PiB7IGUuc3RvcFByb3BhZ2F0aW9uKCk7IHNldEFjdGl2ZU1lbnUobnVsbCk7IHNldFByb2plY3RUb0RlbGV0ZShwKTsgfX0+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8VHJhc2ggc2l6ZT17MTZ9IGNsYXNzTmFtZT1cInRleHQtWyNFMDVBNUFdXCIgLz5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIERlbGV0ZVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICAgIDwvPlxyXG4gICAgICAgICAgICAgICAgICAgICl9XHJcbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC1bMTRweF0gdGV4dC1jbGF1ZGUtdGV4dFNlY29uZGFyeSBsaW5lLWNsYW1wLTMgbGVhZGluZy1yZWxheGVkIGZsZXgtMVwiPlxyXG4gICAgICAgICAgICAgICAgICB7cC5kZXNjcmlwdGlvbiB8fCBcIk5vIGRlc2NyaXB0aW9uIHByb3ZpZGVkLlwifVxyXG4gICAgICAgICAgICAgICAgPC9wPlxyXG5cclxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwibXQtNCBwdC0xIGZsZXggaXRlbXMtY2VudGVyIGdhcC00IHRleHQtWzEycHhdIHRleHQtY2xhdWRlLXRleHRTZWNvbmRhcnkvODBcIj5cclxuICAgICAgICAgICAgICAgICAgPHNwYW4+VXBkYXRlZCB7bmV3IERhdGUocC51cGRhdGVkX2F0KS50b0xvY2FsZURhdGVTdHJpbmcoKX08L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgIHsocC5maWxlX2NvdW50ID8/IDApID4gMCAmJiA8c3Bhbj7igKIge3AuZmlsZV9jb3VudH0gZmlsZXM8L3NwYW4+fVxyXG4gICAgICAgICAgICAgICAgICB7KHAuY2hhdF9jb3VudCA/PyAwKSA+IDAgJiYgPHNwYW4+4oCiIHtwLmNoYXRfY291bnR9IGNoYXRzPC9zcGFuPn1cclxuICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICApKX1cclxuICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICkgOiAoXHJcbiAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggZmxleC1jb2wgaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIG10LTEyXCI+XHJcbiAgICAgICAgICAgIDxpbWcgc3JjPXtzdGFydFByb2plY3RzSW1nfSBhbHQ9XCJTdGFydCBhIHByb2plY3RcIiBjbGFzc05hbWU9XCJ3LVsxMDBweF0gaC1hdXRvIG1iLTYgZGFyazppbnZlcnQgb3BhY2l0eS05MFwiIC8+XHJcbiAgICAgICAgICAgIDxoMiBjbGFzc05hbWU9XCJ0ZXh0LVsxN3B4XSBmb250LW1lZGl1bSB0ZXh0LWNsYXVkZS10ZXh0IG1iLTNcIj5Mb29raW5nIHRvIHN0YXJ0IGEgcHJvamVjdD88L2gyPlxyXG4gICAgICAgICAgICA8cCBjbGFzc05hbWU9XCJ0ZXh0LVsxNXB4XSB0ZXh0LWNsYXVkZS10ZXh0U2Vjb25kYXJ5IHRleHQtY2VudGVyIG1heC13LVs0MDBweF0gbGVhZGluZy1yZWxheGVkIG1iLTZcIj5cclxuICAgICAgICAgICAgICBVcGxvYWQgbWF0ZXJpYWxzLCBzZXQgY3VzdG9tIGluc3RydWN0aW9ucywgYW5kIG9yZ2FuaXplIGNvbnZlcnNhdGlvbnMgaW4gb25lIHNwYWNlLlxyXG4gICAgICAgICAgICA8L3A+XHJcbiAgICAgICAgICAgIDxidXR0b25cclxuICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBzZXRJc0NyZWF0aW5nKHRydWUpfVxyXG4gICAgICAgICAgICAgIGNsYXNzTmFtZT1cImZsZXggaXRlbXMtY2VudGVyIGdhcC0yIHB4LTQgcHktMiBiZy10cmFuc3BhcmVudCBib3JkZXIgYm9yZGVyLWNsYXVkZS1ib3JkZXIgaG92ZXI6YmctY2xhdWRlLWhvdmVyIHJvdW5kZWQteGwgdGV4dC1jbGF1ZGUtdGV4dCB0cmFuc2l0aW9uLWNvbG9ycyB0ZXh0LVsxNC41cHhdIGZvbnQtbWVkaXVtXCJcclxuICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgIDxQbHVzIHNpemU9ezE4fSBzdHJva2VXaWR0aD17Mi41fSAvPlxyXG4gICAgICAgICAgICAgIE5ldyBwcm9qZWN0XHJcbiAgICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgKX1cclxuICAgICAgPC9kaXY+XHJcblxyXG4gICAgICB7cHJvamVjdFRvRGVsZXRlICYmIChcclxuICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZpeGVkIGluc2V0LTAgei1bMTAwXSBmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciBiZy1ibGFjay81MCBiYWNrZHJvcC1ibHVyLXNtIHAtNFwiPlxyXG4gICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJiZy1jbGF1ZGUtaW5wdXQgdy1bNDYwcHhdIHJvdW5kZWQtWzE2cHhdIGZsZXggZmxleC1jb2wgc2hhZG93LTJ4bCByZWxhdGl2ZSBib3JkZXIgYm9yZGVyLWNsYXVkZS1ib3JkZXIgb3ZlcmZsb3ctaGlkZGVuXCI+XHJcbiAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwicHgtNiBwdC02IHBiLTQgdGV4dC1sZWZ0XCI+XHJcbiAgICAgICAgICAgICAgPGgzIGNsYXNzTmFtZT1cInRleHQtWzE5cHhdIGZvbnQtc2VtaWJvbGQgdGV4dC1jbGF1ZGUtdGV4dCBtYi0zXCI+RGVsZXRlIHByb2plY3Q8L2gzPlxyXG4gICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQtWzE1cHhdIHRleHQtY2xhdWRlLXRleHRTZWNvbmRhcnkgbGVhZGluZy1yZWxheGVkIHByLTRcIj5cclxuICAgICAgICAgICAgICAgIOehruWumuimgeWIoOmZpOmhueebruOAjHtwcm9qZWN0VG9EZWxldGUubmFtZX3jgI3lkJfvvJ/miYDmnInlhbPogZTnmoTmlofku7blkozlr7nor53kuZ/kvJrooqvliKDpmaTjgIJcclxuICAgICAgICAgICAgICA8L3A+XHJcbiAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInB4LTUgcGItNSBwdC0yIGZsZXgganVzdGlmeS1lbmQgZ2FwLTMgbXQtNFwiPlxyXG4gICAgICAgICAgICAgIDxidXR0b25cclxuICAgICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHNldFByb2plY3RUb0RlbGV0ZShudWxsKX1cclxuICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cInB4LTUgcHktMiB0ZXh0LVsxNC41cHhdIGZvbnQtbWVkaXVtIHRleHQtY2xhdWRlLXRleHQgYm9yZGVyIGJvcmRlci1jbGF1ZGUtYm9yZGVyIGhvdmVyOmJnLWNsYXVkZS1ob3ZlciByb3VuZGVkLVs4cHhdIHRyYW5zaXRpb24tY29sb3JzXCJcclxuICAgICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgICBDYW5jZWxcclxuICAgICAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICAgICAgICA8YnV0dG9uXHJcbiAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBoYW5kbGVEZWxldGVQcm9qZWN0KHByb2plY3RUb0RlbGV0ZSl9XHJcbiAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJweC01IHB5LTIgdGV4dC1bMTQuNXB4XSBmb250LW1lZGl1bSB0ZXh0LXdoaXRlIGJnLVsjRTA1QTVBXSBob3ZlcjpiZy1bI0U4NkI2Ql0gcm91bmRlZC1bOHB4XSB0cmFuc2l0aW9uLWNvbG9yc1wiXHJcbiAgICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgICAgRGVsZXRlXHJcbiAgICAgICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgPC9kaXY+XHJcbiAgICAgICl9XHJcblxyXG4gICAgICB7cHJvamVjdFRvRWRpdCAmJiAoXG4gICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZml4ZWQgaW5zZXQtMCB6LVsxMDBdIGZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIGJnLWJsYWNrLzUwIGJhY2tkcm9wLWJsdXItc20gcC00XCI+XG4gICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJiZy1jbGF1ZGUtaW5wdXQgdy1bNDYwcHhdIHJvdW5kZWQtWzE2cHhdIGZsZXggZmxleC1jb2wgc2hhZG93LTJ4bCByZWxhdGl2ZSBib3JkZXIgYm9yZGVyLWNsYXVkZS1ib3JkZXIgb3ZlcmZsb3ctaGlkZGVuXCI+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInB4LTYgcHQtNiBwYi00IHRleHQtbGVmdFwiPlxyXG4gICAgICAgICAgICAgIDxoMyBjbGFzc05hbWU9XCJ0ZXh0LVsxOXB4XSBmb250LXNlbWlib2xkIHRleHQtY2xhdWRlLXRleHQgbWItNVwiPkVkaXQgZGV0YWlsczwvaDM+XHJcblxyXG4gICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwic3BhY2UteS00XCI+XHJcbiAgICAgICAgICAgICAgICA8ZGl2PlxyXG4gICAgICAgICAgICAgICAgICA8bGFiZWwgY2xhc3NOYW1lPVwiYmxvY2sgdGV4dC1bMTRweF0gdGV4dC1jbGF1ZGUtdGV4dFNlY29uZGFyeSBtYi0yIGZvbnQtbWVkaXVtXCI+TmFtZTwvbGFiZWw+XHJcbiAgICAgICAgICAgICAgICAgIDxpbnB1dFxyXG4gICAgICAgICAgICAgICAgICAgIHR5cGU9XCJ0ZXh0XCJcclxuICAgICAgICAgICAgICAgICAgICB2YWx1ZT17ZWRpdERldGFpbHNOYW1lfVxyXG4gICAgICAgICAgICAgICAgICAgIG9uQ2hhbmdlPXsoZSkgPT4gc2V0RWRpdERldGFpbHNOYW1lKGUudGFyZ2V0LnZhbHVlKX1cclxuICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJ3LWZ1bGwgcHgtMyBweS0yIGJnLXRyYW5zcGFyZW50IGJvcmRlciBib3JkZXItY2xhdWRlLWJvcmRlciByb3VuZGVkLVs4cHhdIHRleHQtY2xhdWRlLXRleHQgb3V0bGluZS1ub25lIGZvY3VzOmJvcmRlci1bIzNBN0FEQV0gZm9jdXM6cmluZy0xIGZvY3VzOnJpbmctWyMzQTdBREFdIHRyYW5zaXRpb24tYWxsIHRleHQtWzE1cHhdXCJcclxuICAgICAgICAgICAgICAgICAgICBhdXRvRm9jdXNcclxuICAgICAgICAgICAgICAgICAgLz5cclxuICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgPGRpdj5cclxuICAgICAgICAgICAgICAgICAgPGxhYmVsIGNsYXNzTmFtZT1cImJsb2NrIHRleHQtWzE0cHhdIHRleHQtY2xhdWRlLXRleHRTZWNvbmRhcnkgbWItMiBmb250LW1lZGl1bVwiPkRlc2NyaXB0aW9uPC9sYWJlbD5cclxuICAgICAgICAgICAgICAgICAgPHRleHRhcmVhXHJcbiAgICAgICAgICAgICAgICAgICAgdmFsdWU9e2VkaXREZXRhaWxzRGVzY31cclxuICAgICAgICAgICAgICAgICAgICBvbkNoYW5nZT17KGUpID0+IHNldEVkaXREZXRhaWxzRGVzYyhlLnRhcmdldC52YWx1ZSl9XHJcbiAgICAgICAgICAgICAgICAgICAgcm93cz17NH1cclxuICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJ3LWZ1bGwgcHgtMyBweS0yIGJnLWNsYXVkZS1iZyBib3JkZXIgYm9yZGVyLWNsYXVkZS1ib3JkZXIgcm91bmRlZC1bOHB4XSB0ZXh0LWNsYXVkZS10ZXh0IG91dGxpbmUtbm9uZSBmb2N1czpib3JkZXItWyMzQTdBREFdIGZvY3VzOnJpbmctMSBmb2N1czpyaW5nLVsjM0E3QURBXSB0cmFuc2l0aW9uLWFsbCByZXNpemUtbm9uZSB0ZXh0LVsxNC41cHhdIGxlYWRpbmctcmVsYXhlZFwiXHJcbiAgICAgICAgICAgICAgICAgIC8+XHJcbiAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInB4LTYgcGItNiBwdC0yIGZsZXgganVzdGlmeS1lbmQgZ2FwLTMgbXQtNFwiPlxyXG4gICAgICAgICAgICAgIDxidXR0b25cclxuICAgICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHNldFByb2plY3RUb0VkaXQobnVsbCl9XHJcbiAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJweC01IHB5LTIuNSB0ZXh0LVsxNC41cHhdIGZvbnQtbWVkaXVtIHRleHQtY2xhdWRlLXRleHQgYm9yZGVyIGJvcmRlci1jbGF1ZGUtYm9yZGVyIGhvdmVyOmJnLWNsYXVkZS1ob3ZlciByb3VuZGVkLVs4cHhdIHRyYW5zaXRpb24tY29sb3JzXCJcclxuICAgICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgICBDYW5jZWxcclxuICAgICAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICAgICAgICA8YnV0dG9uXHJcbiAgICAgICAgICAgICAgICBvbkNsaWNrPXtoYW5kbGVTYXZlRWRpdERldGFpbHN9XHJcbiAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJweC01IHB5LTIuNSB0ZXh0LVsxNC41cHhdIGZvbnQtbWVkaXVtIGJnLWNsYXVkZS10ZXh0IHRleHQtY2xhdWRlLWJnIGhvdmVyOm9wYWNpdHktOTAgcm91bmRlZC1bOHB4XSB0cmFuc2l0aW9uLW9wYWNpdHlcIlxyXG4gICAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICAgIFNhdmVcclxuICAgICAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgPC9kaXY+XG4gICAgICApfVxuXG4gICAgICB7aXNDcmVhdGluZyAmJiAoXG4gICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZml4ZWQgaW5zZXQtMCB6LVsxMDBdIGZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIGJnLWJsYWNrLzQwIHAtNFwiPlxuICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwidy1bNjQ4cHhdIG1heC13LVtjYWxjKDEwMHZ3LTJyZW0pXSByb3VuZGVkLTJ4bCBib3JkZXIgYm9yZGVyLWNsYXVkZS1ib3JkZXIgYmctY2xhdWRlLWJnIHNoYWRvdy14bFwiPlxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGl0ZW1zLXN0YXJ0IGp1c3RpZnktYmV0d2VlbiBweC02IHBiLTQgcHQtNVwiPlxuICAgICAgICAgICAgICA8aDMgY2xhc3NOYW1lPVwidGV4dC1bMjJweF0gZm9udC1bU3BlY3RyYWxdIHRleHQtY2xhdWRlLXRleHRcIiBzdHlsZT17eyBmb250V2VpZ2h0OiA2MDAgfX0+Q3JlYXRlIGEgcHJvamVjdDwvaDM+XG4gICAgICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgICAgICB0eXBlPVwiYnV0dG9uXCJcbiAgICAgICAgICAgICAgICBvbkNsaWNrPXtoYW5kbGVDbG9zZUNyZWF0ZU1vZGFsfVxuICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cImZsZXggaC04IHctOCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgcm91bmRlZC1sZyB0ZXh0LWNsYXVkZS10ZXh0U2Vjb25kYXJ5IHRyYW5zaXRpb24tY29sb3JzIGhvdmVyOmJnLWNsYXVkZS1ob3ZlciBob3Zlcjp0ZXh0LWNsYXVkZS10ZXh0XCJcbiAgICAgICAgICAgICAgICBhcmlhLWxhYmVsPVwiQ2xvc2VcIlxuICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgPFggc2l6ZT17MTh9IC8+XG4gICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInB4LTYgcGItNlwiPlxuICAgICAgICAgICAgICA8UHJvamVjdENyZWF0ZUZvcm1cbiAgICAgICAgICAgICAgICBvblN1Ym1pdD17aGFuZGxlQ3JlYXRlfVxuICAgICAgICAgICAgICAgIG9uQ2FuY2VsPXtoYW5kbGVDbG9zZUNyZWF0ZU1vZGFsfVxuICAgICAgICAgICAgICAgIHByb2plY3ROYW1lPXtwcm9qZWN0TmFtZX1cbiAgICAgICAgICAgICAgICBwcm9qZWN0RGVzY3JpcHRpb249e3Byb2plY3REZXNjcmlwdGlvbn1cbiAgICAgICAgICAgICAgICBwcm9qZWN0TmFtZUVycm9yPXtwcm9qZWN0TmFtZUVycm9yfVxuICAgICAgICAgICAgICAgIG9uUHJvamVjdE5hbWVDaGFuZ2U9eyh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgc2V0UHJvamVjdE5hbWUodmFsdWUpO1xuICAgICAgICAgICAgICAgICAgaWYgKHByb2plY3ROYW1lRXJyb3IpIHNldFByb2plY3ROYW1lRXJyb3IobnVsbCk7XG4gICAgICAgICAgICAgICAgfX1cbiAgICAgICAgICAgICAgICBvblByb2plY3REZXNjcmlwdGlvbkNoYW5nZT17c2V0UHJvamVjdERlc2NyaXB0aW9ufVxuICAgICAgICAgICAgICAgIHNob3dHdWlkZT17cHJvamVjdHMubGVuZ3RoID09PSAwfVxuICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIDwvZGl2PlxuICAgICAgKX1cbiAgICA8L2Rpdj5cbiAgKTtcbn07XG5cclxuZXhwb3J0IGRlZmF1bHQgUHJvamVjdHNQYWdlO1xyXG4iXSwiZmlsZSI6IkQ6L3dvcmsvcHkvY2xhdWRlL2NsYXVkZS1kZXNrdG9wL3NyYy9jb21wb25lbnRzL1Byb2plY3RzUGFnZS50c3gifQ==

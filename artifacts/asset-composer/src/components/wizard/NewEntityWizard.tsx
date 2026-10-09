import { uiLabel } from "@/lib/uiLabels";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStore } from "@/store";
import { getTemplatesForEntityType } from "@/data/templates";
import { sanitizeSvg } from "@/lib/sanitize";
import { getTemplatePresentationSummary } from "@/lib/templatePresentation";
import type { EntityType } from "@/domain/types";
import { User, Ghost, Bird, Sword, Box, Music } from "lucide-react";
import { openAsset } from "@/lib/assetNavigation";
import { useWorkbench } from "@/store/workbench";

const LEGACY_ENTITY_TYPES: { type: EntityType; label: string; icon: React.ReactNode; description: string }[] = [
  { type: "character", label: "Персонаж", icon: <User className="w-5 h-5" />, description: "Playable hero or NPC humanoid" },
  { type: "monster", label: "Существо", icon: <Ghost className="w-5 h-5" />, description: "Enemy creature or boss" },
  { type: "animal", label: "Животное / ездовое", icon: <Bird className="w-5 h-5" />, description: "Quadruped, bird, or mount" },
  { type: "item", label: "Предмет", icon: <Sword className="w-5 h-5" />, description: "Weapon, armor, or accessory" },
  { type: "static_object", label: "Объект окружения", icon: <Box className="w-5 h-5" />, description: "Chest, barrel, tree, catapult" },
  { type: "animation_pack", label: "Набор анимаций", icon: <Music className="w-5 h-5" />, description: "Reusable animation set" },
];
const ENTITY_TYPES = LEGACY_ENTITY_TYPES.filter(entry => entry.type === "character");

type Step = "type" | "template" | "name";

export function NewEntityWizard() {
  const editor = useStore(s => s.editor);
  const closeWizard = useStore(s => s.closeWizard);
  const createEntity = useStore(s => s.createEntity);

  const [step, setStep] = useState<Step>("template");
  const [selectedType, setSelectedType] = useState<EntityType | null>("character");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [name, setName] = useState("");

  const compatibleTemplates = selectedType
    ? getTemplatesForEntityType(selectedType).filter(template => template.id.startsWith("biped_profile_"))
    : [];

  useEffect(() => {
    if (editor.isWizardOpen) return;
    setStep("template");
    setSelectedType("character");
    setSelectedTemplateId(null);
    setName("");
  }, [editor.isWizardOpen]);

  function handleClose() {
    closeWizard();
  }

  function handleCreate() {
    if (!selectedType || !selectedTemplateId || !name.trim()) return;
    createEntity(selectedType, selectedTemplateId, name.trim());
    const id = useStore.getState().project.activeEntityId;
    if (id) openAsset({ kind: "entity", id });
    handleClose();
  }

  if (!editor.isWizardOpen) return null;

  return (
    <Dialog open onOpenChange={open => { if (!open) handleClose(); }}>
      <DialogContent className="max-w-xl bg-card border-border text-foreground">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold text-foreground">
            {step === "type" && "Choose Entity Type"}
            {step === "template" && "Телосложение"}
            {step === "name" && "Имя персонажа"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Выберите телосложение и имя. Внешность и экипировку можно настроить после создания.
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Entity Type */}
        {step === "type" && (
          <div className="grid grid-cols-2 gap-2">
            {ENTITY_TYPES.map(et => (
              <button
                key={et.type}
                data-testid={`wizard-type-${et.type}`}
                onClick={() => { setSelectedType(et.type); setStep("template"); }}
                className="flex items-start gap-3 rounded-lg border border-border bg-accent/40 p-3 text-left hover:border-primary/60 hover:bg-accent transition-colors"
              >
                <span className="mt-0.5 text-primary">{et.icon}</span>
                <div>
                  <p className="text-sm font-medium text-foreground">{et.label}</p>
                  <p className="text-xs text-muted-foreground">{et.description}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Step 2: Template */}
        {step === "template" && (
          <div className="space-y-3">
            {compatibleTemplates.length === 0 && (
              <p className="text-sm text-muted-foreground">Пока нет основ для этого типа объекта.</p>
            )}
            <div className="grid grid-cols-1 gap-2">
              {compatibleTemplates.map(t => (
                <button
                  key={t.id}
                  data-testid={`wizard-template-${t.id}`}
                  onClick={() => { setSelectedTemplateId(t.id); setStep("name"); setName("Персонаж"); }}
                  className="flex items-center gap-4 rounded-lg border border-border bg-accent/40 p-3 text-left hover:border-primary/60 hover:bg-accent transition-colors"
                >
                  <div
                    className="w-12 h-12 rounded border border-border flex-shrink-0 overflow-hidden bg-background"
                    dangerouslySetInnerHTML={{ __html: sanitizeSvg(t.thumbnailSvg) }}
                  />
                  <div>
                    <p className="text-sm font-medium text-foreground">{t.id.includes("slim") ? "Стройное" : t.id.includes("sturdy") ? "Крепкое" : "Обычное"}</p>
                  </div>
                </button>
              ))}
            </div>
            <div className="flex gap-2 pt-2 border-t border-border">
              <Button variant="ghost" size="sm" onClick={handleClose} className="text-xs">
                Отмена
              </Button>
              <Button variant="ghost" size="sm" onClick={() => useWorkbench.setState({ createCategory: null })}>Другой тип объекта</Button>
            </div>
          </div>
        )}

        {/* Step 3: Name */}
        {step === "name" && (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Имя</label>
              <Input
                data-testid="wizard-name-input"
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleCreate(); }}
                placeholder="Например, Рыцарь"
                className="bg-background border-border text-foreground"
                autoFocus
              />
            </div>
            <div className="flex gap-2 pt-2 border-t border-border">
              <Button variant="ghost" size="sm" onClick={() => setStep("template")} className="text-xs">
                ← Назад
              </Button>
              <Button
                data-testid="wizard-create-btn"
                size="sm"
                onClick={handleCreate}
                disabled={!name.trim()}
                className="ml-auto bg-primary text-primary-foreground hover:bg-primary/90 text-xs"
              >
                Создать персонажа
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

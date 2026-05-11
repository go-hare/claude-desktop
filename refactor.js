const fs = require('fs');
const file = 'c:/Users/Administrator/Desktop/claude-app/Claude_clone/src/components/CustomizePage.tsx';
let content = fs.readFileSync(file, 'utf8');

const regexFileTreeNodeDef = /  const FileTreeNode = \(\{ skill, isExpanded, onExpand \}: \{ skill: Skill, isExpanded: boolean, onExpand: \(e: React\.MouseEvent\) => void \}\) => \{[\s\S]*?    \);\n  \};\n/;

const match = regexFileTreeNodeDef.exec(content);
if (match) {
    const origDef = match[0];
    content = content.replace(origDef, '');

    const newProps = `interface FileTreeNodeProps {
  skill: Skill;
  isExpanded: boolean;
  onExpand: (e: React.MouseEvent) => void;
  selectedSkillId: string | null;
  detail: Skill | null;
  selectSkill: (id: string) => void;
  setSelectedFile: (name: string) => void;
  setSelectedSkillId: (id: string) => void;
  loadFileContent: (skillId: string, filePath: string) => void;
}

const FileTreeNode: React.FC<FileTreeNodeProps> = ({
  skill, isExpanded, onExpand,
  selectedSkillId, detail, selectSkill,
  setSelectedFile, setSelectedSkillId, loadFileContent
}) => {`;
    let newDef = origDef.replace(/  const FileTreeNode = \(\{ skill, isExpanded, onExpand \}: \{ skill: Skill, isExpanded: boolean, onExpand: \(e: React\.MouseEvent\) => void \}\) => \{/, newProps);

    // reduce indentation of newDef by 2 spaces
    newDef = newDef.split('\n').map(l => l.startsWith('  ') ? l.substring(2) : l).join('\n');

    const insertIndex = content.indexOf('const CustomizePage =');
    content = content.substring(0, insertIndex) + newDef + '\n' + content.substring(insertIndex);

    // now replace `<FileTreeNode` usage
    content = content.replace(/<FileTreeNode\s+key=\{skill\.id\}\s+skill=\{skill\}\s+isExpanded=\{expandedSkills\.has\(skill\.id\)\}\s+onExpand=\{\(e\) => toggleSkillExpand\(skill\.id, e\)\}\s+\/>/g,
        `<FileTreeNode
    key={skill.id}
    skill={skill}
    isExpanded={expandedSkills.has(skill.id)}
    onExpand={(e) => toggleSkillExpand(skill.id, e)}
    selectedSkillId={selectedSkillId}
    detail={detail}
    selectSkill={selectSkill}
    setSelectedFile={setSelectedFile}
    setSelectedSkillId={setSelectedSkillId}
    loadFileContent={loadFileContent}
  />`
    );

    fs.writeFileSync(file, content);
    console.log('Successfully refactored FileTreeNode');
} else {
    console.log('Failed to find FileTreeNode definition');
}

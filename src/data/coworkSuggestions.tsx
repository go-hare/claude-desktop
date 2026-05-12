import React from 'react';
import { Folder, WandSparkles } from 'lucide-react';

export type CoworkSuggestionItem = {
  id: string;
  icon: React.ReactNode;
  title: string;
  prompt: string;
};

export const COWORK_SUGGESTIONS: CoworkSuggestionItem[] = [
  {
    id: 'downloads',
    icon: <Folder size={24} strokeWidth={1.7} />,
    title: 'Clean up my Downloads folder',
    prompt: `Help me organize my Downloads folder.

First, scan and show me a summary:
- Total files and total size
- Files older than 30 days
- Largest files taking up space

Before organizing, ask me:
- What categories or folder structure would be most useful
- Whether I want to delete or archive old files
- If there are specific file types I want to prioritize (documents, images, installers, etc.)

Then focus only on files older than 30 days first. Show me a proposed plan for these old files:
- Categories to create
- Files to delete (installers, duplicates, temp files)
- Files to keep with where they should go

After I approve, organize the first 15 old files as a preview. If there are more files, check in before continuing.`,
  },
  {
    id: 'photos',
    icon: <Folder size={24} strokeWidth={1.7} />,
    title: 'Organize photos by event/date',
    prompt: `Help me organize photos on my Desktop or Downloads folder.

First, scan the folder and show me a summary:
- Total photos
- Date range (oldest to newest)
- Rough size breakdown

Before organizing, ask me how I want them grouped and show me a proposed plan with examples.`,
  },
  {
    id: 'inbox',
    icon: <WandSparkles size={22} strokeWidth={1.7} />,
    title: 'Organize my inbox',
    prompt: `Help me organize and clean up my email inbox.

First, scan my inbox and show me a summary:
- Total unread emails
- Emails older than 30 days
- The main senders or types of emails

Before organizing, ask me what folders, senders, and categories I want to prioritize.`,
  },
];


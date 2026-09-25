// The tool registry. To add a tool: build its page under src/tools/<id>/, then add one entry
// here and one case in Site.tsx. The landing page, nav and footer pick it up automatically.
import type { ComponentType } from 'react';
import { LinkIcon, QrIcon, SparkIcon } from './icons';

export interface ToolInfo {
  id: string;
  path: string;
  name: string;
  /** One line for cards and the nav. */
  tagline: string;
  /** Short paragraph shown at the top of the tool page. */
  description: string;
  icon: ComponentType;
  /** Card accent colour. */
  accent: string;
  features: string[];
  status: 'live' | 'soon';
}

export const SITE = {
  name: 'Forever Tools',
  repoUrl: 'https://github.com/vikasbanjare/QR-Code-Generator',
};

export const TOOLS: ToolInfo[] = [
  {
    id: 'qr',
    path: '/qr',
    name: 'QR Code Generator',
    tagline: 'Branded QR codes that never expire.',
    description: 'Your link is stored inside the code itself, so there is no subscription and nothing to switch off.',
    icon: QrIcon,
    accent: '#043B72',
    features: ['Logo, colours & shapes', 'Automatic scan test', 'SVG, PNG & print PDF'],
    status: 'live',
  },
  {
    id: 'links',
    path: '/links',
    name: 'Link Shortener',
    tagline: 'Short links you own, kept in your own GitHub.',
    description: 'Links are saved in your own GitHub repository and published as simple pages. No database, no monthly plan.',
    icon: LinkIcon,
    accent: '#B85A05',
    features: ['Custom names like /menu', 'Change the destination later', 'One-click QR code'],
    status: 'live',
  },
  {
    id: 'more',
    path: '/',
    name: 'More tools',
    tagline: 'New tools are on the way.',
    description: '',
    icon: SparkIcon,
    accent: '#5A6B80',
    features: [],
    status: 'soon',
  },
];

export const LIVE_TOOLS = TOOLS.filter((t) => t.status === 'live');

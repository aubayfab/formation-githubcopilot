import './theme/neon.css';
import './shell/crt.css';
import './theme/sobre.css';
import './shell/theme.css';

import './games/snake';
import './games/2048';
import './games/casse-briques';

import { chargerScores } from './scores/scoreStore';
import { construireArcade } from './shell/cabinet';
import { demarrerClavier } from './shell/input';
import { demarrerMenu } from './shell/menu';
import { demarrerTheme, installerBascule } from './shell/theme';

const racine = document.querySelector<HTMLElement>('#app');
if (!racine) throw new Error('Élément #app introuvable.');

demarrerTheme();
const arcade = construireArcade(racine);
installerBascule(document.body);
demarrerClavier();
await chargerScores();
demarrerMenu(arcade);

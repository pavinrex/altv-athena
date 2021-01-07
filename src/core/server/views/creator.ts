import * as alt from 'alt-server';
import { View_Events_Creator } from '../../shared/enums/views';
import { Appearance } from '../../shared/interfaces/Appearance';
import { CharacterInfo } from '../../shared/interfaces/CharacterInfo';
import { handleNewCharacter } from './characters';
import * as sm from 'simplymongo';
import { Character } from '../../shared/interfaces/Character';

const db: sm.Database = sm.getDatabase();

alt.onClient(View_Events_Creator.Done, handleCreatorDone);
alt.onClient(View_Events_Creator.AwaitModel, handleAwaitModel);
alt.onClient(View_Events_Creator.AwaitName, handleAwaitNameValid);

/**
 * Called when a player pushes up Character Creator data.
 * @param  {alt.Player} player
 * @param  {Appearance} appearance
 */
function handleCreatorDone(player: alt.Player, appearance: Appearance, info: CharacterInfo, name: string): void {
    if (!player.pendingCharacterEdit) {
        alt.log(`${player.name} | Attempted to edit a character when no edit was requested.`);
        return;
    }

    if (!info) {
        alt.log(`${player.name} | Has zero characters. Sending to character editor.`);
        player.pendingNewCharacter = false;
        player.pendingCharacterEdit = false;
        player.pendingCharacterSelect = true;
        handleNewCharacter(player);
        return;
    }

    if (player.pendingNewCharacter) {
        player.pendingNewCharacter = false;
        player.createNewCharacter(appearance, info, name);
        return;
    }

    player.pendingCharacterEdit = false;
    player.updateDataByKeys(appearance, 'appearance');
    player.updateDataByKeys(info, 'info');
    player.updateAppearance();

    // Resync Position After Appearance for Interior Bug
    alt.setTimeout(() => {
        if (!player || !player.valid) {
            return;
        }

        player.safeSetPosition(player.pos.x, player.pos.y, player.pos.z);
    }, 500);
}

function handleAwaitModel(player: alt.Player, characterSex: number, shouldTPose: boolean): void {
    player.model = characterSex === 0 ? 'mp_f_freemode_01' : 'mp_m_freemode_01';
    player.pos = player.pos;
    alt.emitClient(player, View_Events_Creator.AwaitModel, shouldTPose);
}

async function handleAwaitNameValid(player: alt.Player, name: string): Promise<void> {
    const result = await db.fetchData<Character>('name', name, 'characters');

    if (!result) {
        alt.emitClient(player, View_Events_Creator.AwaitName, true); // Yes the name is available.
        return;
    }

    alt.emitClient(player, View_Events_Creator.AwaitName, false); // No the name is not available.
}

import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Outlet } from '@lotmorewins/types';
import { offerBadge } from '../../lib/offer';
import { colors, fonts, GUTTER, radius, space } from '../../theme/tokens';
import { Glass, Txt } from '../ui';
import { OutletLogo } from './OutletLogo';

const COLUMNS = 3;
const GAP = space.sm;
/** Inner padding of a tile around its logo. */
const TILE_PADDING = space.xs;
/** Tablets keep 3 columns; past this width a tile stops growing and the grid is centred. */
const MAX_TILE = 190;
const NAME_LINE = 17;

/** Tile width for 3 columns inside the screen gutter with even gaps, capped on wide screens. */
function useTileWidth() {
  const { width } = useWindowDimensions();
  const available = width - GUTTER * 2;
  return Math.min(MAX_TILE, Math.floor((available - GAP * (COLUMNS - 1)) / COLUMNS));
}

function OutletTile({ outlet, size, onPress }: { outlet: Outlet; size: number; onPress: () => void }) {
  const logo = size - TILE_PADDING * 2;
  const badge = offerBadge(outlet.offer);
  return (
    <Glass
      lite
      onPress={onPress}
      accessibilityLabel={badge ? `${outlet.name}, ${badge} discount` : outlet.name}
      rounded={radius.lg}
      style={[styles.tile, { width: size }]}
    >
      <View style={{ width: logo, height: logo }}>
        <OutletLogo outlet={outlet} size={logo} corner={radius.md} />
        {outlet.offer?.givesCashReward ? (
          <View style={styles.cash} accessibilityLabel="Cash reward">
            <Ionicons name="cash" size={11} color={colors.textOnGold} />
          </View>
        ) : null}
        {badge ? (
          <View style={[styles.badge, { maxWidth: logo }]}>
            <Txt style={styles.badgeText} numberOfLines={1}>
              {badge}
            </Txt>
          </View>
        ) : null}
      </View>
      <View style={styles.nameBox}>
        <Txt style={styles.name} numberOfLines={2}>
          {outlet.name}
        </Txt>
      </View>
    </Glass>
  );
}

/** The participating outlets as a 3-column grid of glass tiles: logo, discount tag and name. */
export function OutletGrid({ outlets, onOpen }: { outlets: Outlet[]; onOpen: (outlet: Outlet) => void }) {
  const size = useTileWidth();
  const gridWidth = size * COLUMNS + GAP * (COLUMNS - 1);
  return (
    <View style={[styles.grid, { width: gridWidth }]}>
      {outlets.map((outlet) => (
        <OutletTile key={outlet.id} outlet={outlet} size={size} onPress={() => onOpen(outlet)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP, alignSelf: 'center' },
  tile: { padding: TILE_PADDING, paddingBottom: space.xs },
  // Overhangs the logo's top-right corner, inside the tile's padding so the tile does not clip it.
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.brandRed,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.75)',
    boxShadow: '0px 2px 6px rgba(20, 2, 2, 0.5)',
  },
  badgeText: { fontFamily: fonts.bold, fontSize: 10, lineHeight: 14, color: colors.white },
  cash: {
    position: 'absolute',
    left: 4,
    bottom: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Room for two lines on every tile so the grid rows line up.
  nameBox: { height: NAME_LINE * 2, marginTop: space.xs, justifyContent: 'center' },
  name: { fontFamily: fonts.medium, fontSize: 12, lineHeight: NAME_LINE, color: colors.text, textAlign: 'center' },
});

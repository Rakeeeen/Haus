/**
 * Pixel pictograms for the world clocks — one per country. They're drawn on a grid
 * twice as fine as the face's own (half-cell pixels), so there's room for real
 * detail: up to 12 wide × 8 tall, centred on the face's lower half under the hands.
 */
export const CLOCK_EMBLEMS = {
  // Great Pyramid
  egypt: [
    '.....##.....',
    '....####....',
    '...######...',
    '..########..',
    '.##########.',
    '############',
  ],
  // Big Ben — spire, clock face, tower
  london: [
    '..##..',
    '..##..',
    '.####.',
    '.#..#.',
    '.####.',
    '.####.',
    '.####.',
    '.####.',
  ],
  // Burj Khalifa — needle and stepped tiers
  dubai: [
    '..#..',
    '..#..',
    '.###.',
    '.###.',
    '.###.',
    '#####',
    '#####',
    '#####',
  ],
  // Date palm
  saudi: [
    '..##...##..',
    '.#.#####.#.',
    '#...###...#',
    '.....#.....',
    '.....#.....',
    '.....#.....',
    '.....#.....',
    '....###....',
  ],
  // Khanjar — hilt, guard, curved sheath
  oman: [
    '.#####.',
    '...#...',
    '..###..',
    '#######',
    '.#####.',
    '..####.',
    '...###.',
    '....##.',
  ],
  // Southern Cross
  australia: [
    '.....#.....',
    '....###....',
    '.#...#...#.',
    '###.....###',
    '.#.......#.',
    '.....#..#..',
    '....###....',
    '.....#.....',
  ],
} as const;

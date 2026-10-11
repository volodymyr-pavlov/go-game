// Package game is the Go engine: the board, the rules, the scoring and the tree search. The JSON layer that talks to the web app is package wire.
package game

// Cell is what is on one point of the board. Black and White are separate bits, so one Cell can also hold both colours as a set.
type Cell uint8

const (
	Black Cell = 1 << iota
	White
	Empty Cell = 0
)

// Opponent returns the other colour. It must not be called on Empty.
func (c Cell) Opponent() Cell {
	return (Black | White) &^ c
}

func (c Cell) String() string {
	switch c {
	case Black:
		return "Black"
	case White:
		return "White"
	}
	return "Empty"
}

// Point is one position on the board. Y grows from the top down, the same way the screen draws it.
type Point struct {
	X, Y int
}

func onBoard(size int, p Point) bool {
	return p.X >= 0 && p.X < size && p.Y >= 0 && p.Y < size
}

func indexOf(size int, p Point) int { return p.X*size + p.Y }
func pointOf(size int, i int) Point { return Point{i / size, i % size} }

// A copy of a Board still shares the cells with the original. Use Clone when you need a separate board.
type Board struct {
	size  int
	cells []Cell
	topo  *topology
}

func New(size int) Board {
	return Board{size: size, cells: make([]Cell, size*size), topo: topologyFor(size)}
}

func (b Board) Size() int { return b.size }

func (b Board) Len() int { return len(b.cells) }

func (b Board) Clone() Board {
	cells := make([]Cell, len(b.cells))
	copy(cells, b.cells)
	return Board{size: b.size, cells: cells, topo: b.topo}
}

func (b Board) CopyFrom(other Board) {
	copy(b.cells, other.cells)
}

func (b Board) OnBoard(p Point) bool { return onBoard(b.size, p) }

func (b Board) Index(p Point) int   { return indexOf(b.size, p) }
func (b Board) PointOf(i int) Point { return pointOf(b.size, i) }

func (b Board) At(p Point) Cell     { return b.cells[b.Index(p)] }
func (b Board) AtIndex(i int) Cell  { return b.cells[i] }
func (b Board) Set(p Point, c Cell) { b.cells[b.Index(p)] = c }
func (b Board) SetIndex(i int, c Cell) {
	b.cells[i] = c
}

// Neighbors returns a slice that is shared. Do not change it.
func (b Board) Neighbors(i int) []int { return b.topo.neighbors[i] }

// Diagonals returns a slice that is shared. Do not change it.
func (b Board) Diagonals(i int) []int { return b.topo.diagonals[i] }

func (b Board) Count(c Cell) int {
	n := 0
	for _, cell := range b.cells {
		if cell == c {
			n++
		}
	}
	return n
}

// A group with fewer liberties than this is in atari: one more stone of the opponent takes it.
const libertiesOutOfAtari = 2

func (b Board) HasAnyLiberty(i int, scratch *Scratch) bool {
	return b.hasLiberties(i, 1, scratch)
}

func (b Board) InAtari(i int, scratch *Scratch) bool {
	return !b.hasLiberties(i, libertiesOutOfAtari, scratch)
}

func (b Board) hasLiberties(i int, atLeast int, scratch *Scratch) bool {
	return b.countLibertiesUpTo(i, atLeast, scratch) >= atLeast
}

// countLibertiesUpTo is the hot loop of every playout. It is written out by hand because going through Scratch.flood costs about 15% of search time.
func (b Board) countLibertiesUpTo(i int, limit int, scratch *Scratch) int {
	color := b.cells[i]
	if color == Empty {
		return 0
	}
	scratch.fit(len(b.cells))
	stone, liberty := scratch.nextMark(), scratch.nextMark()
	scratch.stack = append(scratch.stack[:0], i)
	scratch.mark[i] = stone
	count := 0

	for len(scratch.stack) > 0 {
		current := scratch.stack[len(scratch.stack)-1]
		scratch.stack = scratch.stack[:len(scratch.stack)-1]
		for _, n := range b.topo.neighbors[current] {
			switch c := b.cells[n]; {
			case c == Empty && scratch.mark[n] != liberty:
				scratch.mark[n] = liberty
				count++
				if count >= limit {
					return count
				}
			case c == color && scratch.mark[n] != stone:
				scratch.mark[n] = stone
				scratch.stack = append(scratch.stack, n)
			}
		}
	}
	return count
}

func (b Board) RemoveGroup(i int, scratch *Scratch) int {
	color := b.cells[i]
	if color == Empty {
		return 0
	}
	group := scratch.flood(b, i, func(n int) bool { return b.cells[n] == color })
	for _, stone := range group {
		b.cells[stone] = Empty
	}
	return len(group)
}

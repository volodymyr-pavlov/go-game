package game

type Group struct {
	Stones    []Point
	Liberties int
}

// FromDiagram builds a board from lines of text. '.' is an empty point, 'X' is a black stone, 'O' is a white stone. The first line is y = 0.
func FromDiagram(rows []string) Board {
	b := New(len(rows))
	for y, row := range rows {
		for x, char := range row {
			switch char {
			case 'X':
				b.Set(Point{X: x, Y: y}, Black)
			case 'O':
				b.Set(Point{X: x, Y: y}, White)
			}
		}
	}
	return b
}

func GroupAt(b Board, p Point) Group {
	origin := b.Index(p)
	color := b.At(p)
	if color == Empty {
		return Group{}
	}
	s := NewScratch(b.Len())
	group := Group{}
	for _, i := range s.flood(b, origin, func(n int) bool { return b.AtIndex(n) == color }) {
		group.Stones = append(group.Stones, b.PointOf(i))
	}
	group.Liberties = countLiberties(b, origin, s)
	return group
}

func countLiberties(b Board, i int, s *Scratch) int {
	return b.countLibertiesUpTo(i, b.Len(), s)
}

func position(rows []string, toPlay Cell) Position {
	p := Initial(len(rows))
	p.Board = FromDiagram(rows)
	p.ToPlay = toPlay
	return p
}

func Initial(size int) Position {
	return Position{Board: New(size), ToPlay: Black, Ko: NoKo}
}

func (p Position) CheckMove(point Point) error {
	if !p.Board.OnBoard(point) {
		return ErrOffBoard
	}
	scratch := borrowScratch()
	defer releaseScratch(scratch)
	return p.turn(scratch).check(p.Board.Index(point))
}

func IsOwnEye(b Board, point Point, stone Cell) bool {
	return isOwnEye(b, b.Index(point), stone)
}

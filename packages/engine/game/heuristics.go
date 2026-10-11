package game

const (
	diagonalsInTheMiddle    = 4
	maxBadDiagonalsForAnEye = 1
)

// sensible is true when the move is legal and does not fill one of the player's own eyes.
func (t turn) sensible(i int) bool {
	return t.board.AtIndex(i) == Empty && !isOwnEye(t.board, i, t.stone) && t.legal(i)
}

// isOwnEye adds one hostile point for a point on the edge or in a corner, however many diagonals it is missing. So there every diagonal that is on the board must be safe.
func isOwnEye(b Board, i int, stone Cell) bool {
	for _, n := range b.Neighbors(i) {
		if b.AtIndex(n) != stone {
			return false
		}
	}
	diagonals := b.Diagonals(i)
	hostile := 0
	if len(diagonals) < diagonalsInTheMiddle {
		hostile++
	}
	opponent := stone.Opponent()
	for _, d := range diagonals {
		if b.AtIndex(d) == opponent {
			hostile++
		}
	}
	return hostile <= maxBadDiagonalsForAnEye
}

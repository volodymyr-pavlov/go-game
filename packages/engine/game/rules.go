package game

import (
	"errors"
)

var (
	ErrOffBoard = errors.New("point is outside the board")
	ErrOccupied = errors.New("intersection is occupied")
	ErrKo       = errors.New("ko: immediate recapture is illegal")
	ErrSuicide  = errors.New("suicide is illegal")
)

const PassesToFinish = 2

const NoKo = -1

type Position struct {
	Board  Board
	ToPlay Cell
	// Ko is the point that the ko rule blocks for the next move. It is NoKo when there is no such point.
	Ko                int
	Captures          Captures
	ConsecutivePasses int
}

// Captures counts the stones each colour has taken.
type Captures struct {
	Black, White int
}

func (c *Captures) Add(stone Cell, n int) {
	switch stone {
	case Black:
		c.Black += n
	case White:
		c.White += n
	}
}

type Move struct {
	Point Point
	Pass  bool
}

func PassMove() Move         { return Move{Pass: true} }
func PointMove(p Point) Move { return Move{Point: p} }

func (p Position) Finished() bool {
	return p.ConsecutivePasses >= PassesToFinish
}

func (p Position) Play(point Point) (Position, error) {
	if !p.Board.OnBoard(point) {
		return Position{}, ErrOffBoard
	}
	return p.PlayIndex(p.Board.Index(point))
}

func (p Position) PlayIndex(i int) (Position, error) {
	scratch := borrowScratch()
	defer releaseScratch(scratch)
	if err := p.turn(scratch).check(i); err != nil {
		return Position{}, err
	}
	onCopy := p.turn(scratch).onBoard(p.Board.Clone())
	placed := onCopy.place(i)
	captures := p.Captures
	captures.Add(p.ToPlay, placed.captured)
	return Position{Board: onCopy.board, ToPlay: p.ToPlay.Opponent(), Ko: placed.ko, Captures: captures}, nil
}

func (p Position) Pass() Position {
	return Position{
		Board:             p.Board,
		ToPlay:            p.ToPlay.Opponent(),
		Ko:                NoKo,
		Captures:          p.Captures,
		ConsecutivePasses: p.ConsecutivePasses + 1,
	}
}

func (p Position) turn(scratch *Scratch) turn {
	return turn{board: p.Board, stone: p.ToPlay, ko: p.Ko, scratch: scratch}
}

// turn is one side about to move on a board. The board shares its cells with the caller, so place changes the caller's board.
type turn struct {
	board   Board
	stone   Cell
	ko      int
	scratch *Scratch
}

// onBoard is the same turn on another board.
func (t turn) onBoard(board Board) turn {
	t.board = board
	return t
}

// placed is what a stone leaves behind: how many stones it took, and the point the ko rule blocks next (NoKo for none).
type placed struct {
	captured int
	ko       int
}

// capture is the result of taking stones off the board. at is the point of the last stone taken. The ko rule uses it when exactly one stone was taken.
type capture struct {
	stones int
	at     int
}

func (t turn) check(i int) error {
	switch {
	case i < 0 || i >= t.board.Len():
		return ErrOffBoard
	case t.board.AtIndex(i) != Empty:
		return ErrOccupied
	case i == t.ko:
		return ErrKo
	case t.isSuicide(i):
		return ErrSuicide
	}
	return nil
}

func (t turn) legal(i int) bool {
	return t.check(i) == nil
}

func (t turn) place(i int) placed {
	t.board.SetIndex(i, t.stone)
	opponent := t.stone.Opponent()
	taken := capture{at: NoKo}
	for _, n := range t.board.Neighbors(i) {
		if t.board.AtIndex(n) != opponent || t.board.HasAnyLiberty(n, t.scratch) {
			continue
		}
		taken.at = n
		taken.stones += t.board.RemoveGroup(n, t.scratch)
	}
	return placed{captured: taken.stones, ko: t.koAfter(i, taken)}
}

func (t turn) isSuicide(i int) bool {
	opponent := t.stone.Opponent()
	for _, n := range t.board.Neighbors(i) {
		switch t.board.AtIndex(n) {
		case Empty:
			return false
		case t.stone:
			if !t.board.InAtari(n, t.scratch) {
				return false
			}
		case opponent:
			if t.board.InAtari(n, t.scratch) {
				return false
			}
		}
	}
	return true
}

// Ko rule: when one stone captures exactly one stone and is then left with one free point, it may not be captured back on the very next move.
func (t turn) koAfter(i int, taken capture) int {
	if taken.stones != 1 {
		return NoKo
	}
	for _, n := range t.board.Neighbors(i) {
		if t.board.AtIndex(n) == t.stone {
			return NoKo // connected, so not a lone stone
		}
	}
	if !t.board.InAtari(i, t.scratch) {
		return NoKo
	}
	return taken.at
}

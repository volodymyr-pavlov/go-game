package game

import (
	"math/rand/v2"
)

type moveIndex = int32

const passIndex moveIndex = -1

// Result is the answer of a search: the move that was tried the most, its win rate for the player who makes it, and how often it was tried.
type Result struct {
	Move    Move
	WinRate float64
	Visits  int
}

// Search plays the given number of random games from the position. It returns the move that was tried the most times.
func Search(position Position, playouts int, rng *rand.Rand) Result {
	s := NewScratch(position.Board.Len())
	board := newPlayoutBoard(position.Board.Size(), s)
	root := &node{position: position, move: passIndex}

	for range playouts {
		leaf := expandOne(selectLeaf(root), rng, s)
		winner := board.run(leaf.position, rng)
		backpropagate(leaf, winner)
	}

	best := root.mostVisitedChild()
	if best == nil {
		return Result{Move: PassMove()}
	}
	return Result{Move: moveOf(position.Board, best.move), WinRate: best.winRate(), Visits: best.visits}
}

func moveOf(b Board, m moveIndex) Move {
	if m == passIndex {
		return PassMove()
	}
	return PointMove(b.PointOf(int(m)))
}

func selectLeaf(root *node) *node {
	n := root
	for !n.terminal() && n.fullyExpanded() && len(n.children) > 0 {
		n = n.selectChild()
	}
	return n
}

func expandOne(n *node, rng *rand.Rand, s *Scratch) *node {
	if n.terminal() {
		return n
	}
	n.listMoves(s)
	if n.fullyExpanded() {
		return n
	}
	return n.expand(rng)
}

func backpropagate(leaf *node, winner Cell) {
	for n := leaf; n != nil; n = n.parent {
		n.record(winner)
	}
}

// apply plays a move that candidateMoves listed. Such a move is legal, so an error here is a bug in the engine.
func apply(p Position, m moveIndex) Position {
	if m == passIndex {
		return p.Pass()
	}
	next, err := p.PlayIndex(int(m))
	if err != nil {
		panic(err)
	}
	return next
}

// candidateMoves adds a pass only when the opponent has just passed, or when there is no other move.
func candidateMoves(p Position, s *Scratch) []moveIndex {
	var moves []moveIndex
	t := p.turn(s)
	for i := range p.Board.Len() {
		if t.sensible(i) {
			moves = append(moves, moveIndex(i))
		}
	}
	if p.ConsecutivePasses > 0 || len(moves) == 0 {
		moves = append(moves, passIndex)
	}
	return moves
}

package game

import (
	"math/rand/v2"
)

// A random game that has not ended after this many moves per point is cut off and scored as it stands, so a playout always finishes.
const maxPlayoutMovesPerPoint = 2

type playoutBoard struct {
	board   Board
	pool    []moveIndex
	scratch *Scratch
}

func newPlayoutBoard(size int, s *Scratch) *playoutBoard {
	return &playoutBoard{board: New(size), pool: make([]moveIndex, 0, size*size), scratch: s}
}

func (pb *playoutBoard) run(start Position, rng *rand.Rand) Cell {
	pb.board.CopyFrom(start.Board)
	t := turn{board: pb.board, stone: start.ToPlay, ko: start.Ko, scratch: pb.scratch}
	passes := start.ConsecutivePasses
	maxMoves := pb.board.Len() * maxPlayoutMovesPerPoint

	for i := 0; i < maxMoves && passes < PassesToFinish; i++ {
		if m := pb.randomSensibleMove(t, rng); m == passIndex {
			passes++
			t.ko = NoKo
		} else {
			t.ko = t.place(int(m)).ko
			passes = 0
		}
		t.stone = t.stone.Opponent()
	}
	return Winner(pb.board, pb.scratch)
}

func (pb *playoutBoard) randomSensibleMove(t turn, rng *rand.Rand) moveIndex {
	pool := pb.pool[:0]
	for i := range pb.board.Len() {
		if pb.board.AtIndex(i) == Empty {
			pool = append(pool, moveIndex(i))
		}
	}
	for last := len(pool) - 1; last >= 0; last-- {
		pick := rng.IntN(last + 1)
		pool[pick], pool[last] = pool[last], pool[pick]
		if t.sensible(int(pool[last])) {
			return pool[last]
		}
	}
	return passIndex
}

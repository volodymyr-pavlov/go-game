package game

import "sync"

// A Scratch must not be shared between goroutines. Each goroutine needs its own.
// The stack is shared by the liberty count and by flood, so run one at a time. The accept function of a flood must not use the same Scratch.
type Scratch struct {
	mark       []uint32
	generation uint32
	stack      []int
	region     []int
}

func NewScratch(cells int) *Scratch {
	return &Scratch{mark: make([]uint32, cells)}
}

// The pool spares the callers that have no Scratch of their own, like Play, from allocating one for a single move.
var scratches = sync.Pool{New: func() any { return NewScratch(0) }}

func borrowScratch() *Scratch   { return scratches.Get().(*Scratch) }
func releaseScratch(s *Scratch) { scratches.Put(s) }

func (s *Scratch) fit(cells int) {
	if len(s.mark) < cells {
		s.mark = make([]uint32, cells)
		s.generation = 0
	}
}

func (s *Scratch) nextMark() uint32 {
	s.generation++
	if s.generation == 0 {
		clear(s.mark)
		s.generation = 1
	}
	return s.generation
}

// freshMark makes room for a board of cells points and returns a mark that no point on it carries yet.
func (s *Scratch) freshMark(cells int) uint32 {
	s.fit(cells)
	return s.nextMark()
}

// flood returns origin and every point connected to it through points that accept. The slice is reused by the next flood, so use it right away.
func (s *Scratch) flood(b Board, origin int, accept func(i int) bool) []int {
	return s.floodMarked(b, origin, s.freshMark(b.Len()), accept)
}

// floodMarked is flood with a mark from freshMark. Several floods can share the mark, so the caller can tell afterwards which points any of them reached.
func (s *Scratch) floodMarked(b Board, origin int, mark uint32, accept func(i int) bool) []int {
	s.region = s.region[:0]
	s.stack = append(s.stack[:0], origin)
	s.mark[origin] = mark
	for len(s.stack) > 0 {
		current := s.stack[len(s.stack)-1]
		s.stack = s.stack[:len(s.stack)-1]
		s.region = append(s.region, current)
		for _, n := range b.topo.neighbors[current] {
			if s.mark[n] != mark && accept(n) {
				s.mark[n] = mark
				s.stack = append(s.stack, n)
			}
		}
	}
	return s.region
}

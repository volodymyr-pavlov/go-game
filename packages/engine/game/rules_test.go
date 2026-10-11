package game

import (
	"errors"
	"testing"
)

func mustPlay(t *testing.T, p Position, x, y int) Position {
	t.Helper()
	next, err := p.Play(Point{X: x, Y: y})
	if err != nil {
		t.Fatalf("expected %d,%d to be legal, got %v", x, y, err)
	}
	return next
}

func TestCaptureRemovesStoneAndCounts(t *testing.T) {
	p := position([]string{".X...", "XOX..", ".....", ".....", "....."}, Black)
	next := mustPlay(t, p, 1, 2)
	if next.Board.At(Point{X: 1, Y: 1}) != Empty || next.Captures.Black != 1 {
		t.Fatal("captured stone not removed or not counted")
	}
}

func TestSuicideIsIllegalUnlessItCaptures(t *testing.T) {
	suicide := position([]string{".O...", "O.O..", ".O...", ".....", "....."}, Black)
	if _, err := suicide.Play(Point{X: 1, Y: 1}); !errors.Is(err, ErrSuicide) {
		t.Fatalf("err = %v, want ErrSuicide", err)
	}
	capturing := position([]string{".OX..", "O.OX.", ".OX..", ".....", "....."}, Black)
	if next := mustPlay(t, capturing, 1, 1); next.Captures.Black != 1 {
		t.Fatalf("captures = %v", next.Captures)
	}
}

func TestSimpleKoForbidsImmediateRecaptureOnly(t *testing.T) {
	p := position([]string{".....", ".XO..", "X.XO.", ".XO..", "....."}, White)
	afterCapture := mustPlay(t, p, 1, 2)
	if afterCapture.Ko != afterCapture.Board.Index(Point{X: 2, Y: 2}) {
		t.Fatalf("Ko = %v", afterCapture.Ko)
	}
	if _, err := afterCapture.Play(Point{X: 2, Y: 2}); !errors.Is(err, ErrKo) {
		t.Fatalf("err = %v, want ErrKo", err)
	}
	afterTenuki := mustPlay(t, afterCapture, 4, 4)
	afterTenuki = mustPlay(t, afterTenuki, 4, 0)
	if err := afterTenuki.CheckMove(Point{X: 2, Y: 2}); err != nil {
		t.Fatalf("recapture should be legal after a tenuki, got %v", err)
	}
}

func TestOccupiedIsIllegal(t *testing.T) {
	p := position([]string{"X....", ".....", ".....", ".....", "....."}, White)
	if _, err := p.Play(Point{}); !errors.Is(err, ErrOccupied) {
		t.Fatalf("err = %v, want ErrOccupied", err)
	}
}

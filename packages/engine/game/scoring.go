package game

// Chinese scoring. Each side gets one point for every stone on the board and one for every empty point it surrounds. White also gets komi.

const Komi = 6.5

// Winner is the colour with more points under Chinese scoring. Komi has a half point, so there is no tie.
func Winner(b Board, s *Scratch) Cell {
	blackTerritory, whiteTerritory := territoryCounts(b, s)
	black := b.Count(Black) + blackTerritory
	white := b.Count(White) + whiteTerritory
	return winnerByScore(float64(black), float64(white)+Komi)
}

// territoryCounts is the number of empty points each side surrounds.
func territoryCounts(b Board, s *Scratch) (black, white int) {
	eachTerritory(b, s, func(_ int, owner Cell) {
		switch owner {
		case Black:
			black++
		case White:
			white++
		}
	})
	return black, white
}

func winnerByScore(black, white float64) Cell {
	if black > white {
		return Black
	}
	return White
}

func soleOwner(borders Cell) Cell {
	switch borders {
	case Black, White:
		return borders
	}
	return Empty
}

// eachTerritory visits every empty point in a region that touches stones of one colour only. All regions share one mark, so a point that an earlier region reached is not flooded again.
func eachTerritory(b Board, s *Scratch, visit func(i int, owner Cell)) {
	seen := s.freshMark(b.Len())
	for origin := range b.Len() {
		if b.AtIndex(origin) != Empty || s.mark[origin] == seen {
			continue
		}
		region, borders := floodEmptyRegion(b, origin, seen, s)
		owner := soleOwner(borders)
		if owner == Empty {
			continue
		}
		for _, i := range region {
			visit(i, owner)
		}
	}
}

// floodEmptyRegion returns a slice that is reused. The next call overwrites it, so use the result right away.
func floodEmptyRegion(b Board, origin int, seen uint32, s *Scratch) ([]int, Cell) {
	region := s.floodMarked(b, origin, seen, func(n int) bool { return b.AtIndex(n) == Empty })
	var borders Cell
	for _, i := range region {
		for _, n := range b.Neighbors(i) {
			borders |= b.AtIndex(n)
		}
	}
	return region, borders
}
